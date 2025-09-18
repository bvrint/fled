// Dashboard logic
import { auth, db } from './firebase.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export async function loadSections(teacherId) {
  const q = query(collection(db, 'sections'), where('teacherId', '==', teacherId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addSection(name, grade, teacherId) {
  const docRef = await addDoc(collection(db, 'sections'), {
    name,
    grade,
    teacherId,
    students: [],
    ownerUid: teacherId,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}