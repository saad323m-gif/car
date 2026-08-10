import { db, firebaseConfig } from "./firebase.js";
import { 
    collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
    query, where, limit, serverTimestamp, runTransaction 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";

let currentUserData = null;
export const setRequestsCurrentUser = (data) => currentUserData = data;

// Render Admin Requests View
export function renderRequestsView() {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>Pending User Requests</h2>
        <div class="divider"></div>
        <div id="requests-card-list" class="card-list">
            <p class="loading-text">Loading requests...</p>
        </div>
    `;
    fetchRequests();
}

async function fetchRequests() {
    const listContainer = document.getElementById('requests-card-list');
    listContainer.innerHTML = '<p class="loading-text">Loading requests...</p>';

    try {
        const q = query(collection(db, 'requests'), where('status', '==', 'PENDING'));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="text-align:center; color:#666;">No pending requests.</p>';
            return;
        }

        listContainer.innerHTML = '';
        snapshot.forEach(d => renderRequestCard(d.id, d.data()));

    } catch (error) {
        listContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

function renderRequestCard(id, data) {
    const listContainer = document.getElementById('requests-card-list');
    const card = document.createElement('div');
    card.className = 'card border-blue';
    card.id = `req-${id}`;

    let dateStr = 'N/A';
    if (data.timestamp) {
        dateStr = new Date(data.timestamp.toDate()).toLocaleString('en-GB', { timeZone: 'Asia/Dubai' });
    }

    let bodyHtml = '';
    if (data.type === 'LINK') {
        bodyHtml = `
            <p><strong>Type:</strong> Link Car Request</p>
            <p><strong>Requested By:</strong> ${data.userName}</p>
            <p><strong>Plate Details:</strong> ${data.plateNumber} ${data.plateCode} (${data.emirate})</p>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn btn-sm btn-success" id="approve-req-${id}">Approve</button>
                <button class="btn btn-sm btn-danger" id="reject-req-${id}">Reject</button>
            </div>
            <div id="approve-area-${id}" style="margin-top: 15px; display: none;"></div>
        `;
    } else if (data.type === 'UNLINK') {
        bodyHtml = `
            <p><strong>Type:</strong> Unlink Car Request</p>
            <p><strong>Requested By:</strong> ${data.userName}</p>
            <p><strong>Car ID:</strong> ${data.carId}</p>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn btn-sm btn-success" id="approve-req-${id}">Approve Unlink</button>
                <button class="btn btn-sm btn-danger" id="reject-req-${id}">Reject</button>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-header">
            <span class="card-title">${data.type} Request - ${data.userName}</span>
            <div class="card-meta"><span class="status-pending">${data.status}</span></div>
        </div>
        <div class="card-body" style="display: block;">
            ${bodyHtml}
        </div>
    `;
    listContainer.appendChild(card);

    document.getElementById(`approve-req-${id}`).addEventListener('click', () => handleApprove(id, data));
    document.getElementById(`reject-req-${id}`).addEventListener('click', () => handleReject(id, data));
}

async function handleApprove(reqId, reqData) {
    try {
        if (reqData.type === 'UNLINK') {
            // Approve Unlink
            await updateDoc(doc(db, 'cars', reqData.carId), { currentUserId: null, currentUserName: null });
            
            const assignQ = query(collection(db, 'cars', reqData.carId, 'assignments'), where('userId', '==', reqData.userId), where('endTime', '==', null), limit(1));
            const snap = await getDocs(assignQ);
            if (!snap.empty) {
                await updateDoc(doc(db, 'cars', reqData.carId, 'assignments', snap.docs[0].id), { endTime: serverTimestamp() });
            }

            await updateDoc(doc(db, 'requests', reqId), { status: 'APPROVED' });
            await logAction(currentUserData, 'APPROVE_UNLINK', { targetId: reqData.carId, targetName: reqData.userName, text: `Approved unlink for ${reqData.userName}` });
            showMessage('Unlink approved successfully.', 'success', 'dashboard');
            fetchRequests();
        } else if (reqData.type === 'LINK') {
            // Approve Link: Check if car exists
            const plateId = `${reqData.plateNumber}-${reqData.plateCode}-${reqData.emirate}`.toLowerCase();
            const carQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateId));
            const carSnap = await getDocs(carQ);

            if (!carSnap.empty) {
                // Car exists, assign directly
                const carDoc = carSnap.docs[0];
                await updateDoc(doc(db, 'cars', carDoc.id), { currentUserId: reqData.userId, currentUserName: reqData.userName });
                
                await addDoc(collection(db, 'cars', carDoc.id, 'assignments'), {
                    userId: reqData.userId, userName: reqData.userName, startTime: reqData.timestamp, endTime: null
                });

                await updateDoc(doc(db, 'requests', reqId), { status: 'APPROVED', carId: carDoc.id });
                await logAction(currentUserData, 'APPROVE_LINK', { targetId: carDoc.id, targetName: reqData.userName, text: `Approved link for ${reqData.userName}` });
                showMessage('Link approved successfully.', 'success', 'dashboard');
                fetchRequests();
            } else {
                // Car does not exist, show form to Admin to complete details
                renderCompleteCarForm(reqId, reqData);
            }
        }
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', 'dashboard');
    }
}

function renderCompleteCarForm(reqId, reqData) {
    const area = document.getElementById(`approve-area-${reqId}`);
    area.style.display = 'block';
    area.innerHTML = `
        <h4>Complete Car Details</h4>
        <form id="complete-car-${reqId}">
            <div class="form-group"><label>Type (Make)</label><input type="text" id="cc-type-${reqId}" required></div>
            <div class="form-group"><label>Owner Name</label><input type="text" id="cc-owner-${reqId}" required></div>
            <div class="form-group"><label>VIN (Unique)</label><input type="text" id="cc-vin-${reqId}" required></div>
            <div class="form-group"><label>License Expiry</label><input type="date" id="cc-lic-${reqId}" required></div>
            <div class="form-group"><label>Insurance Expiry</label><input type="date" id="cc-ins-${reqId}" required></div>
            <div class="form-group"><label>Notes</label><input type="text" id="cc-notes-${reqId}"></div>
            <button type="submit" class="btn btn-sm btn-success">Save & Assign</button>
        </form>
    `;

    document.getElementById(`complete-car-${reqId}`).addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleCompleteAndAssign(reqId, reqData);
    });
}

async function handleCompleteAndAssign(reqId, reqData) {
    const type = document.getElementById(`cc-type-${reqId}`).value.trim();
    const owner = document.getElementById(`cc-owner-${reqId}`).value.trim();
    const vin = document.getElementById(`cc-vin-${reqId}`).value.trim().toLowerCase();
    const licExp = document.getElementById(`cc-lic-${reqId}`).value;
    const insExp = document.getElementById(`cc-ins-${reqId}`).value;
    const notes = document.getElementById(`cc-notes-${reqId}`).value.trim();

    try {
        // Check VIN uniqueness
        const vinQ = query(collection(db, 'cars'), where('vin', '==', vin));
        const vinSnap = await getDocs(vinQ);
        if (!vinSnap.empty) return showMessage('Error: This VIN already exists.', 'error', 'dashboard');

        // Generate Car ID
        const counterRef = doc(db, 'counters', 'carId');
        const newCount = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) { transaction.set(counterRef, { count: 1 }); return 1; }
            const nc = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: nc });
            return nc;
        });
        const carId = `UAE-${newCount.toString().padStart(3, '0')}`;

        const plateId = `${reqData.plateNumber}-${reqData.plateCode}-${reqData.emirate}`.toLowerCase();

        await setDoc(doc(db, 'cars', carId), {
            carId, plateNumber: reqData.plateNumber, plateCode: reqData.plateCode.toUpperCase(), emirate: reqData.emirate,
            plateIdentifier: plateId, type, ownerName: owner, vin,
            licenseExpiry: new Date(licExp), insuranceExpiry: new Date(insExp), notes,
            currentUserId: reqData.userId, currentUserName: reqData.userName, status: 'active'
        });

        await addDoc(collection(db, 'cars', carId, 'assignments'), {
            userId: reqData.userId, userName: reqData.userName, startTime: reqData.timestamp, endTime: null
        });

        await updateDoc(doc(db, 'requests', reqId), { status: 'APPROVED', carId: carId });
        await logAction(currentUserData, 'CREATE_CAR', { targetId: carId, targetName: reqData.plateNumber, text: `Created car ${carId} via request` });
        await logAction(currentUserData, 'APPROVE_LINK', { targetId: carId, targetName: reqData.userName, text: `Approved link for ${reqData.userName}` });
        
        showMessage('Car created and assigned successfully.', 'success', 'dashboard');
        fetchRequests();
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', 'dashboard');
    }
}

async function handleReject(reqId, reqData) {
    try {
        await updateDoc(doc(db, 'requests', reqId), { status: 'REJECTED' });
        await logAction(currentUserData, 'REJECT_REQUEST', { targetId: reqId, targetName: reqData.userName, text: `Rejected ${reqData.type} request` });
        showMessage('Request rejected.', 'warning', 'dashboard');
        fetchRequests();
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', 'dashboard');
    }
}

// User Actions
export async function createLinkRequest(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-req');
    btn.disabled = true;
    btn.textContent = "Sending...";

    const plateNum = document.getElementById('req-plate-num').value.trim();
    const plateCode = document.getElementById('req-plate-code').value.trim();
    const emirate = document.getElementById('req-emirate').value.trim();

    try {
        await addDoc(collection(db, 'requests'), {
            type: 'LINK', userId: currentUserData.uid, userName: currentUserData.username,
            plateNumber: plateNum, plateCode: plateCode, emirate: emirate,
            status: 'PENDING', timestamp: serverTimestamp()
        });
        showMessage('Request sent to admin successfully.', 'success', 'dashboard');
        document.getElementById('request-car-form').reset();
        document.getElementById('request-car-form-wrapper').classList.add('hidden-form');
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', 'dashboard');
    } finally {
        btn.disabled = false;
        btn.textContent = "Send Request";
    }
}

export async function createUnlinkRequest(carId, carData) {
    if (!confirm("Send request to admin to unlink this car?")) return;
    try {
        await addDoc(collection(db, 'requests'), {
            type: 'UNLINK', userId: currentUserData.uid, userName: currentUserData.username,
            carId: carId, status: 'PENDING', timestamp: serverTimestamp()
        });
        showMessage('Unlink request sent to admin.', 'success', 'dashboard');
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', 'dashboard');
    }
}