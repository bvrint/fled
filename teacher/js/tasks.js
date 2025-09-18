// Tasks logic
import { db } from './firebase.js';
import { collection, query, where, getDocs, addDoc, doc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export async function loadTasks(sectionId) {
  const q = query(collection(db, 'tasks'), where('sectionId', '==', sectionId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addTask(taskData, sectionId, ownerUid) {
  const docRef = await addDoc(collection(db, 'tasks'), {
    ...taskData,
    sectionId,
    ownerUid,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function deleteTask(taskId) {
  await deleteDoc(doc(db, 'tasks', taskId));
}