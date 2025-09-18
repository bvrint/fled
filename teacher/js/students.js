// Student management logic
import { db } from './firebase.js';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export async function loadStudents(sectionId) {
  const q = query(collection(db, 'students'), where('sectionId', '==', sectionId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function addStudent(studentData, sectionId, ownerUid) {
  // Check if parent exists
  const parentQuery = query(collection(db, 'parents'), where('email', '==', studentData.parentEmail));
  const parentSnapshot = await getDocs(parentQuery);
  let parentId;
  if (parentSnapshot.empty) {
    const parentDoc = await addDoc(collection(db, 'parents'), {
      name: 'Parent of ' + studentData.name,
      email: studentData.parentEmail,
      phone: studentData.parentPhone,
      linkedStudentIds: [],
      ownerUid,
      createdAt: serverTimestamp()
    });
    parentId = parentDoc.id;
  } else {
    parentId = parentSnapshot.docs[0].id;
  }

  const studentDoc = await addDoc(collection(db, 'students'), {
    ...studentData,
    sectionId,
    parentId,
    ownerUid,
    createdAt: serverTimestamp()
  });

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