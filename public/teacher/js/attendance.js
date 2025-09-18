// Attendance logic
import { db } from './firebase.js';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

export async function loadStudentsForAttendance(sectionId) {
  const q = query(collection(db, 'students'), where('sectionId', '==', sectionId));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function saveAttendance(attendanceData, ownerUid) {
  const promises = attendanceData.map(data => 
    addDoc(collection(db, 'attendance'), { ...data, ownerUid, createdAt: serverTimestamp() })
  );
  await Promise.all(promises);
}