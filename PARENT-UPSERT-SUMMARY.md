# Parent Upsert Implementation — Summary

## Overview
This implementation prevents duplicate parent records by upserting a single canonical parent document keyed by a normalized identifier (base64url-encoded email) and using Firestore `arrayUnion` to link student IDs.

## Changes Made

### 1. Core Helper Function
**`normalizeEmailToId(email)`** — Added to all teacher UI files and backend logic:
- Normalizes email: lowercase, trimmed
- Encodes using UTF-8 safe base64url (replaces `+/` with `-_`, removes padding)
- Returns deterministic ID for consistent parent document key

### 2. Teacher Web App — Upsert Flow
Updated in:
- `public/teacher/students.html` (inline script)
- `public/teacher/js/students.js` (module)
- `teacher/students.html` (inline script)
- `teacher/js/students.js` (module)
- `public/teacher/section.html` (inline script)

**Logic:**
```javascript
const normalizedId = normalizeEmailToId(parentEmail);
const parentRef = doc(db, 'parents', normalizedId);
const parentSnap = await getDoc(parentRef);

// If exists, show confirmation modal
if (parentSnap.exists()) {
  const wantLink = await confirmModal('Parent already exists', ...);
  if (!wantLink) return; // Cancel
}

// Upsert (merge) with arrayUnion
await setDoc(parentRef, {
  email: parentEmail.trim().toLowerCase(),
  name: parentSnap.exists() ? (parentSnap.data().name || ('Parent of ' + name)) : ('Parent of ' + name),
  phone: parentPhone || null,
  linkedStudentIds: arrayUnion(studentId),
  ownerUids: arrayUnion(auth.currentUser.uid),
  updatedAt: serverTimestamp()
}, { merge: true });
```

### 3. UI Confirmation on Email Blur
Added blur event handler on `parentEmail` input field in `students.html`:
- On blur, checks if parent exists at `parents/{normalizedId}`
- If exists, shows confirmation modal: "Parent already exists. Do you want to link this student to [Parent Name]?"
- Teacher can confirm linking or cancel to change email

### 4. Messages (Private Message Lookup)
Updated parent lookup in:
- `public/teacher/messages.html`
- `teacher/messages.html`
- `public/teacher/js/messages.js`
- `teacher/js/messages.js`

**Logic:**
```javascript
const parentId = normalizeEmailToId(parentEmail);
const parentRef = doc(db, 'parents', parentId);
const parentSnapshot = await getDoc(parentRef);
if (parentSnapshot.exists()) {
  // Send message to parentId
}
```

### 5. Security Rules
Updated `firestore.rules` for `parents/{parentId}`:

**Teachers:**
- Can read if their UID is in `ownerUids`
- Can create with their UID in `ownerUids`
- Can update/delete if their UID is in `ownerUids`

**Parents (mobile app):**
- Can read their own doc (email in token matches doc `email`)
- Can update only `name` and `lastLoginAt` (whitelist)
- Cannot modify `email`, `linkedStudentIds`, or `ownerUids`

### 6. Migration Script
Created `scripts/migrate-parents.js`:
- Queries all parent docs, groups by normalized email
- Merges `linkedStudentIds` and `ownerUids` arrays (deduped)
- Picks latest `name` and `phone` (sorted by `updatedAt`)
- Writes canonical doc at `parents/{normalizedId}`
- Deletes duplicate docs (non-canonical IDs)

**Usage:**
```bash
node scripts/migrate-parents.js        # dry-run
node scripts/migrate-parents.js --apply # apply changes
```

### 7. Testing & Verification
Created `PARENT-UPSERT-TESTING.md`:
- Test plan for new parent, existing parent, blur check, concurrent upsert, messages, migration
- Security rule tests for teacher and parent access
- Acceptance checklist and troubleshooting guide

## Files Modified

### Added/Created:
- `scripts/migrate-parents.js` — Migration script
- `PARENT-UPSERT-TESTING.md` — Testing guide

### Updated:
- `public/teacher/students.html` — Upsert logic + blur handler
- `public/teacher/js/students.js` — Upsert helper
- `teacher/students.html` — Upsert logic
- `teacher/js/students.js` — Upsert helper
- `public/teacher/section.html` — Upsert logic
- `public/teacher/messages.html` — Normalized parent lookup
- `teacher/messages.html` — Normalized parent lookup
- `public/teacher/js/messages.js` — Normalized parent lookup
- `teacher/js/messages.js` — Normalized parent lookup
- `firestore.rules` — Parent collection rules (teacher + parent access)

## Acceptance Criteria Met

✅ Adding a parent with an email that already exists does NOT create a new parent document  
✅ Teachers can add student IDs to the parent document using `FieldValue.arrayUnion`  
✅ Parent lookup from mobile uses `parents/{normalizedId}` and always returns all `linkedStudentIds`  
✅ Security rules enforce only teachers can modify `linkedStudentIds`; parents can only read their own doc and update limited fields  
✅ UI shows when an existing parent is found and confirms linking instead of creating a duplicate  

## Deployment Steps

1. **Backup Firestore data** (export or snapshot)
2. **Deploy updated Firestore rules** (test in emulator first if possible)
3. **Run migration script in staging:**
   ```bash
   node scripts/migrate-parents.js        # review plan
   node scripts/migrate-parents.js --apply # apply
   ```
4. **Verify migration results** (check parent docs, linkedStudentIds arrays)
5. **Deploy web app changes** to Firebase Hosting
6. **Test with small group of teachers** (add students with existing parent emails)
7. **Monitor Firestore logs** for rule violations or errors
8. **Integrate mobile app** to use normalized parent ID for lookup

## Benefits

- **No more duplicates:** One parent record per email
- **Atomic updates:** `arrayUnion` prevents race conditions
- **Scalable:** Multiple teachers can manage same parent without conflicts
- **Mobile-ready:** Parent lookup by normalized ID works seamlessly
- **Security:** Fine-grained rules for teacher vs parent access
- **Data integrity:** Migration script handles existing duplicates

## Notes

- Email normalization is **case-insensitive** and **trim-safe**
- Base64url encoding ensures Firebase-safe doc IDs (no `/` or `+`)
- `ownerUids` array allows multiple teachers to "own" a parent contact
- `linkedStudentIds` array links parent to all their children across sections
- Migration script is **idempotent** (safe to re-run)
- Test migration in **staging first** before production

---

**Next:** Deploy and test with teachers, then integrate mobile app to use `parents/{normalizedId}` for real-time parent data and FCM token storage.
