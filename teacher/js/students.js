// Student management logic
import { db } from './firebase.js';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, setDoc, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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

export async function loadStudents(sectionId) {
  const q = query(collection(db, 'students'), where('sectionId', '==', sectionId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addStudent(studentData, sectionId, ownerUid) {
  // First create the student document to get its ID
  const studentDoc = await addDoc(collection(db, 'students'), {
    ...studentData,
    sectionId,
    parentId: 'temp', // temporary, will update after parent creation
    ownerUid,
    createdAt: serverTimestamp()
  });
  
  // Now upsert parent using normalized email id and link to the student doc ID
  const normalizedId = normalizeEmailToId(studentData.parentEmail);
  const parentRef = doc(db, 'parents', normalizedId);
  const parentSnap = await getDoc(parentRef);
  await setDoc(parentRef, {
    email: (studentData.parentEmail || '').trim().toLowerCase(),
    name: parentSnap.exists() ? (parentSnap.data().name || ('Parent of ' + studentData.name)) : ('Parent of ' + studentData.name),
    phone: studentData.parentPhone || null,
    linkedStudentIds: arrayUnion(studentDoc.id),
    ownerUids: arrayUnion(ownerUid),
    createdAt: parentSnap.exists() ? parentSnap.data().createdAt || serverTimestamp() : serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  const parentId = normalizedId;
  
  // Update student with correct parentId
  await updateDoc(doc(db, 'students', studentDoc.id), { parentId });

  // Update section
  const sectionDoc = await getDoc(doc(db, 'sections', sectionId));
  const students = sectionDoc.data().students || [];
  students.push({ name: studentData.name, studentId: studentData.studentId });
  await updateDoc(doc(db, 'sections', sectionId), { students });

  return studentDoc.id;
}

export async function deleteStudent(studentId, sectionId) {
  await deleteDoc(doc(db, 'students', studentId));
  // Update section if needed
}