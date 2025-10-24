#!/usr/bin/env node
/**
 * migrate-parents.js
 *
 * Merge duplicate parent documents into a canonical parents/{normalizedId} document.
 * Usage:
 *   node migrate-parents.js        # dry-run, prints plan
 *   node migrate-parents.js --apply # actually apply changes
 *
 * IMPORTANT: Run in staging first and backup your data.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.resolve(__dirname, '..', 'notify-server', 'service-account.json');
if (fs.existsSync(serviceAccountPath)) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
  });
} else {
  console.error('Service account JSON not found at', serviceAccountPath);
  console.error('Please place your service account at that path or set GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}

const db = admin.firestore();

function normalizeEmailToId(email) {
  const s = (email || '').trim().toLowerCase();
  const buf = Buffer.from(s, 'utf8');
  let b64 = buf.toString('base64');
  b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}

async function run(apply) {
  console.log('[migrate-parents] Starting' + (apply ? ' (apply mode)' : ' (dry-run)'));
  const snap = await db.collection('parents').get();
  console.log(`Found ${snap.size} parent docs`);
  const groups = new Map();

  snap.forEach(doc => {
    const data = doc.data() || {};
    const email = (data.email || '').trim().toLowerCase();
    if (!email) return; // skip
    const key = normalizeEmailToId(email);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ id: doc.id, data });
  });

  for (const [key, docs] of groups.entries()) {
    if (docs.length === 1 && docs[0].id === key) continue; // already canonical
    // merge
    const merged = {
      email: docs[0].data.email.trim().toLowerCase(),
      name: null,
      phone: null,
      linkedStudentIds: [],
      ownerUids: [],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    // pick latest name/phone by updatedAt if available
    docs.sort((a,b) => {
      const ta = a.data.updatedAt ? a.data.updatedAt.toMillis ? a.data.updatedAt.toMillis() : 0 : 0;
      const tb = b.data.updatedAt ? b.data.updatedAt.toMillis ? b.data.updatedAt.toMillis() : 0 : 0;
      return tb - ta;
    });
    for (const {id, data} of docs) {
      if (!merged.name && data.name) merged.name = data.name;
      if (!merged.phone && data.phone) merged.phone = data.phone;
      if (Array.isArray(data.linkedStudentIds)) merged.linkedStudentIds.push(...data.linkedStudentIds);
      if (Array.isArray(data.ownerUids)) merged.ownerUids.push(...data.ownerUids);
      else if (data.ownerUid) merged.ownerUids.push(data.ownerUid);
    }
    // dedupe arrays
    merged.linkedStudentIds = Array.from(new Set(merged.linkedStudentIds));
    merged.ownerUids = Array.from(new Set(merged.ownerUids));

    console.log('---');
    console.log('Canonical id:', key);
    console.log('Source docs:', docs.map(d=>d.id).join(', '));
    console.log('Merged name:', merged.name);
    console.log('LinkedStudentIds count:', merged.linkedStudentIds.length);
    console.log('Owner UIDs count:', merged.ownerUids.length);

    if (apply) {
      const ref = db.collection('parents').doc(key);
      await ref.set({
        email: merged.email,
        name: merged.name,
        phone: merged.phone,
        linkedStudentIds: merged.linkedStudentIds,
        ownerUids: merged.ownerUids,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      // delete non-canonical docs
      for (const {id} of docs) {
        if (id !== key) {
          console.log('Deleting duplicate doc', id);
          await db.collection('parents').doc(id).delete();
        }
      }
    }
  }

  console.log('[migrate-parents] Done');
}

const apply = process.argv.includes('--apply');
run(apply).catch(err => {
  console.error(err);
  process.exit(1);
});
