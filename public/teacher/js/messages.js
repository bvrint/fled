// Messaging logic
import { auth, db } from './firebase.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

function normalizeEmailToId(email) {
  const s = (email || '').trim().toLowerCase();
  const enc = new TextEncoder().encode(s);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < enc.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(enc.slice(i, i + chunkSize)));
  }
  let b64 = btoa(binary);
  b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}

export async function sendAnnouncement(content, sectionId) {
  const user = auth.currentUser;
  await addDoc(collection(db, 'messages'), {
    fromTeacherId: user.uid,
    sectionId,
    content,
    ownerUid: user.uid,
    timestamp: serverTimestamp()
  });
}

export async function sendPrivateMessage(content, parentEmail) {
  const user = auth.currentUser;
  const parentId = normalizeEmailToId(parentEmail);
  const parentRef = doc(db, 'parents', parentId);
  const parentSnapshot = await getDoc(parentRef);
  if (parentSnapshot.exists()) {
    await addDoc(collection(db, 'messages'), {
      fromTeacherId: user.uid,
      toParentId: parentId,
      content,
      ownerUid: user.uid,
      timestamp: serverTimestamp()
    });
  } else {
    throw new Error('Parent not found');
  }
}

export async function loadMessages() {
  const user = auth.currentUser;
  const q = query(collection(db, 'messages'), where('fromTeacherId', '==', user.uid));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}