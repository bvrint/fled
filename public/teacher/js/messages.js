// Messaging logic
import { auth, db } from './firebase.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
  const parentQuery = query(collection(db, 'parents'), where('email', '==', parentEmail));
  const parentSnapshot = await getDocs(parentQuery);
  if (!parentSnapshot.empty) {
    const parentId = parentSnapshot.docs[0].id;
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