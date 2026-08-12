/**
 * Requests Module - Car Management System
 * English only | Latin digits only | Production-ready
 *
 * New logic for regular users:
 * - If plate matches an existing car → auto-link immediately
 * - If no match → create PENDING request for admin
 */

import { db } from "./firebase.js";
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
    query, where, limit, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import { showDashboardMessage } from "./messageManager.js";
import { setLoading, UI_TEXTS } from "./loadingManager.js";
import { isAdmin, isActiveUser, renderAccessDenied, formatDateTime, formatCarLabel } from "./utils.js";

let currentUserData = null;
export const setRequestsCurrentUser = (data) => { currentUserData = data; };

export function renderRequestsView() {
    if (!isAdmin(currentUserData)) { renderAccessDenied(); return; }
    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>Pending User Requests</h2>
        <div class="divider"></div>
        <div id="requests-card-list" class="card-list"></div>
    `;
    fetchRequests();
}

async function fetchRequests() {
    if (!isAdmin(currentUserData)) return;
    const listContainer = document.getElementById('requests-card-list');
    if (!listContainer) return;

    setLoading(listContainer, UI_TEXTS.LOADING);
    try {
        const q = query(collection(db, 'requests'), where('status', '==', 'PENDING'));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            listContainer.innerHTML = `<p style="text-align:center; color:#666;">${UI_TEXTS.NO_DATA}</p>`;
            return;
        }
        listContainer.innerHTML = '';
        snapshot.forEach(d => renderRequestCard(d.id, d.data()));
    } catch (error) {
        listContainer.innerHTML = `<p class="error">${UI_TEXTS.ERROR_PREFIX}${error.message}</p>`;
    }
}

function renderRequestCard(id, data) {
    const listContainer = document.getElementById('requests-card-list');
    if (!listContainer) return;

    const card = document.createElement('div');
    card.className = 'card border-blue';
    card.id = `req-${id}`;
    const dateStr = data.timestamp ? formatDateTime(data.timestamp) : 'N/A';

    let bodyHtml = '';
    if (data.type === 'LINK') {
        const plateLabel = `${data.plateNumber} ${data.plateCode} (${data.emirate})`;
        bodyHtml = `
            <div class="detail-list">
                <div class="detail-item"><span class="detail-label">Type</span><span class="detail-value">Link Car Request</span></div>
                <div class="detail-item"><span class="detail-label">Requested By</span><span class="detail-value">${data.userName}</span></div>
                <div class="detail-item"><span class="detail-label">Plate Details</span><span class="detail-value">${plateLabel}</span></div>
                <div class="detail-item"><span class="detail-label">Submitted</span><span class="detail-value">${dateStr}</span></div>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn btn-sm btn-success" id="approve-req-${id}">Approve</button>
                <button class="btn btn-sm btn-danger" id="reject-req-${id}">Reject</button>
            </div>
            <div id="approve-area-${id}" style="margin-top: 15px; display: none;"></div>
        `;
    } else if (data.type === 'UNLINK') {
        const carLabel = data.carId ? (data.plateNumber ? formatCarLabel({ carId: data.carId, plateNumber: data.plateNumber, plateCode: data.plateCode, emirate: data.emirate }) : data.carId) : 'N/A';
        bodyHtml = `
            <div class="detail-list">
                <div class="detail-item"><span class="detail-label">Type</span><span class="detail-value">Unlink Car Request</span></div>
                <div class="detail-item"><span class="detail-label">Requested By</span><span class="detail-value">${data.userName}</span></div>
                <div class="detail-item"><span class="detail-label">Car</span><span class="detail-value">${carLabel}</span></div>
                <div class="detail-item"><span class="detail-label">Submitted</span><span class="detail-value">${dateStr}</span></div>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn btn-sm btn-success" id="approve-req-${id}">Approve Unlink</button>
                <button class="btn btn-sm btn-danger" id="reject-req-${id}">Reject</button>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-header"><span class="card-title">${data.type} Request - ${data.userName}</span><div class="card-meta"><span class="status-pending">${data.status}</span></div></div>
        <div class="card-body" style="display: block;">${bodyHtml}</div>
    `;
    listContainer.appendChild(card);

    document.getElementById(`approve-req-${id}`).addEventListener('click', () => handleApprove(id, data));
    document.getElementById(`reject-req-${id}`).addEventListener('click', () => handleReject(id, data));
}

async function handleApprove(reqId, reqData) {
    if (!isAdmin(currentUserData)) return;
    try {
        if (reqData.type === 'UNLINK') {
            const carRef = doc(db, 'cars', reqData.carId);
            const carSnap = await getDoc(carRef);
            const carData = carSnap.exists() ? carSnap.data() : null;
            const label = carData ? formatCarLabel(carData) : reqData.carId;
            await updateDoc(carRef, { currentUserId: null, currentUserName: null });
            const assignQ = query(collection(db, 'cars', reqData.carId, 'assignments'), where('userId', '==', reqData.userId), where('endTime', '==', null), limit(1));
            const snap = await getDocs(assignQ);
            if (!snap.empty) await updateDoc(doc(db, 'cars', reqData.carId, 'assignments', snap.docs[0].id), { endTime: serverTimestamp() });
            await updateDoc(doc(db, 'requests', reqId), { status: 'APPROVED' });
            await logAction(currentUserData, 'APPROVE_UNLINK', { targetId: reqData.carId, targetName: label, assigneeId: reqData.userId, text: `Approved unlink of ${label} for ${reqData.userName}` });
            showDashboardMessage('Unlink approved successfully.', 'success');
            fetchRequests();
        } else if (reqData.type === 'LINK') {
            const plateId = `${reqData.plateNumber}-${reqData.plateCode.toLowerCase()}-${reqData.emirate.toLowerCase()}`;
            const carQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateId));
            const carSnap = await getDocs(carQ);
            if (!carSnap.empty) {
                const carDoc = carSnap.docs[0];
                const carData = carDoc.data();
                const label = formatCarLabel(carData);
                await updateDoc(doc(db, 'cars', carDoc.id), { currentUserId: reqData.userId, currentUserName: reqData.userName });
                await addDoc(collection(db, 'cars', carDoc.id, 'assignments'), { userId: reqData.userId, userName: reqData.userName, startTime: reqData.timestamp || serverTimestamp(), endTime: null });
                await updateDoc(doc(db, 'requests', reqId), { status: 'APPROVED', carId: carDoc.id });
                await logAction(currentUserData, 'APPROVE_LINK', { targetId: carDoc.id, targetName: label, assigneeId: reqData.userId, text: `Approved link of ${label} for ${reqData.userName}` });
                showDashboardMessage('Link approved successfully.', 'success');
                fetchRequests();
            } else {
                renderCompleteCarForm(reqId, reqData);
            }
        }
    } catch (error) { showDashboardMessage(`Error: ${error.message}`, 'error'); }
}

function renderCompleteCarForm(reqId, reqData) {
    const area = document.getElementById(`approve-area-${reqId}`);
    if (!area) return;
    area.style.display = 'block';
    area.innerHTML = `
        <h4>Complete Car Details</h4>
        <form id="complete-car-${reqId}" class="edit-car-form">
            <div class="form-group"><label>Type (Make)</label><input type="text" id="cc-type-${reqId}" required></div>
            <div class="form-group"><label>Owner Name</label><input type="text" id="cc-owner-${reqId}" required></div>
            <div class="form-group"><label>VIN (Unique)</label><input type="text" id="cc-vin-${reqId}" required maxlength="17"></div>
            <div class="form-group"><label>License Expiry</label><input type="date" id="cc-lic-${reqId}" required></div>
            <div class="form-group"><label>Insurance Expiry</label><input type="date" id="cc-ins-${reqId}" required></div>
            <div class="form-group full-width"><label>Notes</label><input type="text" id="cc-notes-${reqId}"></div>
            <div class="form-group full-width"><button type="submit" class="btn btn-sm btn-success">Save & Assign</button></div>
        </form>
    `;
    document.getElementById(`complete-car-${reqId}`).addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleCompleteAndAssign(reqId, reqData);
    });
}

async function handleCompleteAndAssign(reqId, reqData) {
    if (!isAdmin(currentUserData)) return;
    const type = document.getElementById(`cc-type-${reqId}`).value.trim();
    const owner = document.getElementById(`cc-owner-${reqId}`).value.trim();
    const vin = document.getElementById(`cc-vin-${reqId}`).value.trim().toUpperCase();
    const licExp = document.getElementById(`cc-lic-${reqId}`).value;
    const insExp = document.getElementById(`cc-ins-${reqId}`).value;
    const notes = document.getElementById(`cc-notes-${reqId}`).value.trim();

    try {
        const vinQ = query(collection(db, 'cars'), where('vin', '==', vin));
        const vinSnap = await getDocs(vinQ);
        if (!vinSnap.empty) { showDashboardMessage('Error: This VIN already exists.', 'error'); return; }

        const counterRef = doc(db, 'counters', 'carId');
        const newCount = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) { transaction.set(counterRef, { count: 1 }); return 1; }
            const nc = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: nc });
            return nc;
        });
        const carId = `UAE-${newCount.toString().padStart(3, '0')}`;
        const plateCode = reqData.plateCode.toUpperCase();
        const plateId = `${reqData.plateNumber}-${plateCode.toLowerCase()}-${reqData.emirate.toLowerCase()}`;

        await setDoc(doc(db, 'cars', carId), {
            carId, plateNumber: reqData.plateNumber, plateCode, emirate: reqData.emirate,
            plateIdentifier: plateId, type, ownerName: owner, vin,
            licenseExpiry: new Date(licExp), insuranceExpiry: new Date(insExp),
            notes, currentUserId: reqData.userId, currentUserName: reqData.userName,
            status: 'active', createdAt: serverTimestamp()
        });

        await addDoc(collection(db, 'cars', carId, 'assignments'), { userId: reqData.userId, userName: reqData.userName, startTime: reqData.timestamp || serverTimestamp(), endTime: null });
        await updateDoc(doc(db, 'requests', reqId), { status: 'APPROVED', carId });

        const label = formatCarLabel({ carId, plateNumber: reqData.plateNumber, plateCode, emirate: reqData.emirate });
        await logAction(currentUserData, 'CREATE_CAR', { targetId: carId, targetName: label, text: `Created car ${label} via request` });
        await logAction(currentUserData, 'APPROVE_LINK', { targetId: carId, targetName: label, assigneeId: reqData.userId, text: `Approved link of ${label} for ${reqData.userName}` });
        showDashboardMessage('Car created and assigned successfully.', 'success');
        fetchRequests();
    } catch (error) { showDashboardMessage(`Error: ${error.message}`, 'error'); }
}

async function handleReject(reqId, reqData) {
    if (!isAdmin(currentUserData)) return;
    try {
        await updateDoc(doc(db, 'requests', reqId), { status: 'REJECTED' });
        await logAction(currentUserData, 'REJECT_REQUEST', { targetId: reqId, targetName: reqData.userName, text: `Rejected ${reqData.type} request from ${reqData.userName}` });
        showDashboardMessage('Request rejected.', 'warning');
        fetchRequests();
    } catch (error) { showDashboardMessage(`Error: ${error.message}`, 'error'); }
}

export async function createLinkRequest(e) {
    e.preventDefault();
    if (!isActiveUser(currentUserData)) return;

    const btn = document.getElementById('btn-submit-req');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Processing...';

    const plateNum = document.getElementById('req-plate-num').value.trim();
    const plateCodeRaw = document.getElementById('req-plate-code').value.trim();
    const plateCode = plateCodeRaw.toUpperCase();
    const emirate = document.getElementById('req-emirate').value.trim();
    const plateIdentifier = `${plateNum}-${plateCode.toLowerCase()}-${emirate.toLowerCase()}`;

    try {
        const carQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier));
        const carSnap = await getDocs(carQ);

        if (!carSnap.empty) {
            const carDoc = carSnap.docs[0];
            const carData = carDoc.data();
            const label = formatCarLabel(carData);

            if (carData.currentUserId === currentUserData.uid) {
                showDashboardMessage('This car is already assigned to you.', 'warning');
                return;
            }

            if (carData.currentUserId) {
                const prevAssignQ = query(collection(db, 'cars', carDoc.id, 'assignments'), where('userId', '==', carData.currentUserId), where('endTime', '==', null), limit(1));
                const prevSnap = await getDocs(prevAssignQ);
                if (!prevSnap.empty) await updateDoc(doc(db, 'cars', carDoc.id, 'assignments', prevSnap.docs[0].id), { endTime: serverTimestamp() });
                await logAction(currentUserData, 'FORCE_UNASSIGN', { targetId: carDoc.id, targetName: label, assigneeId: carData.currentUserId, text: `Force unassigned ${label} from ${carData.currentUserName} (requested by ${currentUserData.username})` });
            }

            await updateDoc(doc(db, 'cars', carDoc.id), { currentUserId: currentUserData.uid, currentUserName: currentUserData.username });
            await addDoc(collection(db, 'cars', carDoc.id, 'assignments'), { userId: currentUserData.uid, userName: currentUserData.username, startTime: serverTimestamp(), endTime: null });
            await logAction(currentUserData, 'AUTO_LINK', { targetId: carDoc.id, targetName: label, assigneeId: currentUserData.uid, text: `Auto-linked ${label} to ${currentUserData.username}` });
            showDashboardMessage(`Success: Car ${label} has been linked to you automatically.`, 'success');

            document.getElementById('request-car-form').reset();
            document.getElementById('request-car-form-wrapper').classList.add('hidden-form');
            const { renderCarsView } = await import('./cars.js');
            renderCarsView();
        } else {
            await addDoc(collection(db, 'requests'), {
                type: 'LINK', userId: currentUserData.uid, userName: currentUserData.username,
                plateNumber: plateNum, plateCode: plateCode, emirate: emirate,
                status: 'PENDING', timestamp: serverTimestamp()
            });
            await logAction(currentUserData, 'REQUEST_LINK', { targetName: `${plateNum} ${plateCode} (${emirate})`, text: `Requested link for plate ${plateNum} ${plateCode} (${emirate})` });
            showDashboardMessage('Request sent to admin successfully. The car was not found in the system.', 'success');
            document.getElementById('request-car-form').reset();
            document.getElementById('request-car-form-wrapper').classList.add('hidden-form');
        }
    } catch (error) { showDashboardMessage(`Error: ${error.message}`, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Send Request'; }
}

export async function createUnlinkRequest(carId, carData) {
    if (!isActiveUser(currentUserData)) return;
    if (!confirm('Send request to admin to unlink this car?')) return;

    try {
        const label = formatCarLabel(carData);
        await addDoc(collection(db, 'requests'), {
            type: 'UNLINK', userId: currentUserData.uid, userName: currentUserData.username,
            carId: carId, plateNumber: carData.plateNumber, plateCode: carData.plateCode,
            emirate: carData.emirate, status: 'PENDING', timestamp: serverTimestamp()
        });
        await logAction(currentUserData, 'REQUEST_UNLINK', { targetId: carId, targetName: label, text: `Requested unlink of ${label}` });
        showDashboardMessage('Unlink request sent to admin.', 'success');
    } catch (error) { showDashboardMessage(`Error: ${error.message}`, 'error'); }
}