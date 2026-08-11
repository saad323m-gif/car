// ==========================================
// 1. Timeline Management & Atomic Transactions
// ==========================================
async function assignCarToUser(carId, newUserId, adminUid) {
const carRef = db.collection('cars').doc(carId);
const assignmentsRef = db.collection('cars').doc(carId).collection('assignments');
const logsRef = db.collection('logs');
try {
await db.runTransaction(async (transaction) => {
const carDoc = await transaction.get(carRef);
if (!carDoc.exists) {
throw new Error("Car record not found in the system.");
}
const now = new Date().toISOString();
const activeAssignmentsQuery = assignmentsRef.where('status', '==', 'active').limit(1);
const activeSnapshot = await transaction.get(activeAssignmentsQuery);
if (!activeSnapshot.empty) {
const activeDoc = activeSnapshot.docs[0];
transaction.update(activeDoc.ref, {
endDate: now,
status: 'closed'
});
}
const newAssignmentRef = assignmentsRef.doc();
transaction.set(newAssignmentRef, {
userId: newUserId,
carId: carId,
startDate: now,
endDate: null,
status: 'active',
createdAt: firebase.firestore.FieldValue.serverTimestamp()
});
transaction.update(carRef, {
currentUserId: newUserId,
updatedAt: firebase.firestore.FieldValue.serverTimestamp()
});
const newLogRef = logsRef.doc();
transaction.set(newLogRef, {
action: 'CAR_ASSIGNMENT',
carId: carId,
previousUserId: carDoc.data().currentUserId || null,
newUserId: newUserId,
userId: adminUid,
timestamp: firebase.firestore.FieldValue.serverTimestamp()
});
});
console.log("Car assignment and timeline updated successfully.");
return true;
} catch (error) {
console.error("Assignment failed:", error);
throw error;
}
}
// ==========================================
// 2. UI Component Render Helpers
// ==========================================
function createPlateHTML(code, number) {
return ⁠<div class="plate-container"> <div class="plate-code-box"> <span class="plate-region">ABU DHABI</span> <span class="plate-code">${code}</span> </div> <div class="plate-number-box"> <span class="plate-number">${number}</span> </div> </div>⁠;
}
function createTimelineCardHTML(item) {
const isActive = item.status === 'active' || item.endDate === null;
const startDateStr = formatDate(item.startDate);
const endDateStr = isActive ? 'Present' : formatDate(item.endDate);
const badgeText = isActive ? 'Active' : 'Closed';
const badgeClass = isActive ? 'active' : 'closed';
return ⁠<div class="timeline-card ${isActive ? 'is-active' : ''}"> <div class="timeline-header"> <span class="timeline-period">From: ${startDateStr} - To: ${endDateStr}</span> <span class="status-badge ${badgeClass}">${badgeText}</span> </div> <div class="timeline-body"> <p>User: <strong>${item.userName || item.userId}</strong></p> </div> </div>⁠;
}
function formatDate(isoString) {
if (!isoString) return 'Present';
const date = new Date(isoString);
return date.toLocaleDateString('en-US', {
year: 'numeric',
month: '2-digit',
day: '2-digit',
hour: '2-digit',
minute: '2-digit',
hour12: false
});
}
// ==========================================
// 3. Dynamic Footer & Developer Rights
// ==========================================
function initAppFooter() {
const currentYear = new Date().getFullYear();
const footerElement = document.getElementById('app-footer');
if (footerElement) {
footerElement.innerHTML = ⁠<div class="app-footer"> <p>All rights reserved &copy; ${currentYear} - Fleet & Member Management System</p> </div>⁠;
}
}
document.addEventListener('DOMContentLoaded', () => {
initAppFooter();
});
