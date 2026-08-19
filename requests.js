/**
 * Requests Module - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { db } from "./firebase.js";
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, setDoc,
    query, where, limit, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import {
    showMessage, isAdmin, isActiveUser, renderAccessDenied,
    formatDateTime, formatCarLabel,
    t, lockUI, unlockUI
} from "./utils.js";
import { updateRequestsBadge } from "./app.js";

let currentUserData = null;
export const setRequestsCurrentUser = (data) => { currentUserData = data; };

export function renderRequestsView() {
    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>${t('requests.title')}</h2>
        <div class="divider"></div>
        <div id="requests-card-list" class="card-list">
            <p class="loading-text">${t('common.loading')}</p>
        </div>
    `;
    fetchRequests();
}

async function fetchRequests() {
    if (!isAdmin(currentUserData)) return;

    const listContainer = document.getElementById('requests-card-list');
    if (!listContainer) return;

    listContainer.innerHTML = `<p class="loading-text">${t('common.loading')}</p>`;

    try {
        const q = query(collection(db, 'requests'), where('status', '==', 'PENDING'));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listContainer.innerHTML = `<p style="text-align:center; color:#666;">${t('requests.noPending')}</p>`;
            return;
        }

        listContainer.innerHTML = '';
        snapshot.forEach(d => renderRequestCard(d.id, d.data()));
    } catch (error) {
        listContainer.innerHTML = `<p class="error">${t('error.loadFailed')} ${error.message}</p>`;
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
                <div class="detail-item">
                    <span class="detail-label">${t('requests.type')}</span>
                    <span class="detail-value">${t('requests.linkRequest')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('requests.requestedBy')}</span>
                    <span class="detail-value">${data.userName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('requests.plateDetails')}</span>
                    <span class="detail-value">${plateLabel}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('requests.submitted')}</span>
                    <span class="detail-value">${dateStr}</span>
                </div>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn btn-sm btn-success" id="approve-req-${id}">${t('requests.approve')}</button>
                <button class="btn btn-sm btn-danger" id="reject-req-${id}">${t('requests.reject')}</button>
            </div>
            <div id="approve-area-${id}" style="margin-top: 15px; display: none;"></div>
        `;
    } else if (data.type === 'UNLINK') {
        const carLabel = data.carId
            ? (data.plateNumber ? formatCarLabel({
                carId: data.carId,
                plateNumber: data.plateNumber,
                plateCode: data.plateCode,
                emirate: data.emirate
            }) : data.carId)
            : 'N/A';

        bodyHtml = `
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">${t('requests.type')}</span>
                    <span class="detail-value">${t('requests.unlinkRequest')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('requests.requestedBy')}</span>
                    <span class="detail-value">${data.userName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('cars.carLabel')}</span>
                    <span class="detail-value">${carLabel}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('requests.submitted')}</span>
                    <span class="detail-value">${dateStr}</span>
                </div>
            </div>
            <div style="margin-top: 15px; display: flex; gap: 10px;">
                <button class="btn btn-sm btn-success" id="approve-req-${id}">${t('requests.approveUnlink')}</button>
                <button class="btn btn-sm btn-danger" id="reject-req-${id}">${t('requests.reject')}</button>
            </div>
        `;
    }

    card.innerHTML = `
        <div class="card-header">
            <span class="card-title">${t('requests.type')} ${data.type === 'LINK' ? t('requests.typeLink') : t('requests.typeUnlink')} - ${data.userName}</span>
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
    if (!isAdmin(currentUserData)) return;

    lockUI();
    try {
        if (reqData.type === 'UNLINK') {
            const carRef = doc(db, 'cars', reqData.carId);
            const carSnap = await getDoc(carRef);
            const carData = carSnap.exists() ? carSnap.data() : null;
            const label = carData ? formatCarLabel(carData) : reqData.carId;

            await updateDoc(carRef, {
                currentUserId: null,
                currentUserName: null,
                lastTransferredAt: serverTimestamp()
            });

            const assignQ = query(
                collection(db, 'cars', reqData.carId, 'assignments'),
                where('userId', '==', reqData.userId),
                where('endTime', '==', null),
                limit(1)
            );
            const snap = await getDocs(assignQ);
            if (!snap.empty) {
                await updateDoc(doc(db, 'cars', reqData.carId, 'assignments', snap.docs[0].id), {
                    endTime: serverTimestamp()
                });
            }

            await updateDoc(doc(db, 'requests', reqId), { status: 'APPROVED' });

            await logAction(currentUserData, 'APPROVE_UNLINK', {
                targetId: reqData.carId,
                targetName: label,
                assigneeId: reqData.userId,
                text: t('requests.unlinkApproved')
            });

            showMessage(t('requests.unlinkApproved'), 'success', 'dashboard');
            fetchRequests();
            updateRequestsBadge();

        } else if (reqData.type === 'LINK') {
            const plateId = `${reqData.plateNumber}-${reqData.plateCode.toLowerCase()}-${reqData.emirate.toLowerCase()}`;
            const carQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateId));
            const carSnap = await getDocs(carQ);

            if (!carSnap.empty) {
                const carDoc = carSnap.docs[0];
                const carData = carDoc.data();
                const label = formatCarLabel(carData);

                await updateDoc(doc(db, 'cars', carDoc.id), {
                    currentUserId: reqData.userId,
                    currentUserName: reqData.userName,
                    lastTransferredAt: serverTimestamp()
                });

                await addDoc(collection(db, 'cars', carDoc.id, 'assignments'), {
                    userId: reqData.userId,
                    userName: reqData.userName,
                    startTime: reqData.timestamp || serverTimestamp(),
                    endTime: null
                });

                await updateDoc(doc(db, 'requests', reqId), {
                    status: 'APPROVED',
                    carId: carDoc.id
                });

                await logAction(currentUserData, 'APPROVE_LINK', {
                    targetId: carDoc.id,
                    targetName: label,
                    assigneeId: reqData.userId,
                    text: t('requests.linkApproved')
                });

                showMessage(t('requests.linkApproved'), 'success', 'dashboard');
                fetchRequests();
                updateRequestsBadge();
            } else {
                renderCompleteCarForm(reqId, reqData);
            }
        }
    } catch (error) {
        showMessage(error.message, 'error', 'dashboard');
    } finally {
        unlockUI();
    }
}

function renderCompleteCarForm(reqId, reqData) {
    const area = document.getElementById(`approve-area-${reqId}`);
    if (!area) return;

    area.style.display = 'block';
    area.innerHTML = `
        <h4>${t('requests.completeCarDetails')}</h4>
        <form id="complete-car-${reqId}" class="edit-car-form">
            <div class="form-group">
                <label>${t('cars.type')}</label>
                <input type="text" id="cc-type-${reqId}" required>
            </div>
            <div class="form-group">
                <label>${t('cars.ownerName')}</label>
                <input type="text" id="cc-owner-${reqId}" required>
            </div>
            <div class="form-group">
                <label>${t('cars.vin')}</label>
                <input type="text" id="cc-vin-${reqId}" required>
            </div>
            <div class="form-group">
                <label>${t('cars.manufactureYear')}</label>
                <input type="number" id="cc-year-${reqId}" required min="1900" max="2026" placeholder="e.g. 2020">
            </div>
            <div class="form-group">
                <label>${t('cars.licenseExpiry')}</label>
                <input type="date" id="cc-lic-${reqId}" required>
            </div>
            <div class="form-group">
                <label>${t('cars.insuranceExpiry')}</label>
                <input type="date" id="cc-ins-${reqId}" required>
            </div>
            <div class="form-group full-width">
                <label>${t('cars.notes')}</label>
                <input type="text" id="cc-notes-${reqId}">
            </div>
            <div class="form-group full-width">
                <button type="submit" class="btn btn-sm btn-success">${t('requests.saveAndAssign')}</button>
            </div>
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
    const year = parseInt(document.getElementById(`cc-year-${reqId}`).value);
    const licExp = document.getElementById(`cc-lic-${reqId}`).value;
    const insExp = document.getElementById(`cc-ins-${reqId}`).value;
    const notes = document.getElementById(`cc-notes-${reqId}`).value.trim();

    if (isNaN(year) || year < 1900 || year > 2026) {
        showMessage(t('error.invalidYear'), 'error', 'dashboard');
        return;
    }

    lockUI();
    try {
        const vinQ = query(collection(db, 'cars'), where('vin', '==', vin));
        const vinSnap = await getDocs(vinQ);
        if (!vinSnap.empty) {
            showMessage(t('error.vinExists'), 'error', 'dashboard');
            return;
        }

        const counterRef = doc(db, 'counters', 'carId');
        const newCount = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                transaction.set(counterRef, { count: 1 });
                return 1;
            }
            const nc = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: nc });
            return nc;
        });
        const carId = `UAE-${newCount.toString().padStart(3, '0')}`;

        const plateCode = reqData.plateCode.toUpperCase();
        const plateId = `${reqData.plateNumber}-${plateCode.toLowerCase()}-${reqData.emirate.toLowerCase()}`;

        await setDoc(doc(db, 'cars', carId), {
            carId,
            plateNumber: reqData.plateNumber,
            plateCode,
            emirate: reqData.emirate,
            plateIdentifier: plateId,
            type,
            ownerName: owner,
            vin,
            manufactureYear: year,
            licenseExpiry: new Date(licExp),
            insuranceExpiry: new Date(insExp),
            notes,
            currentUserId: reqData.userId,
            currentUserName: reqData.userName,
            status: 'active',
            createdAt: serverTimestamp(),
            lastTransferredAt: serverTimestamp()
        });

        await addDoc(collection(db, 'cars', carId, 'assignments'), {
            userId: reqData.userId,
            userName: reqData.userName,
            startTime: reqData.timestamp || serverTimestamp(),
            endTime: null
        });

        await updateDoc(doc(db, 'requests', reqId), {
            status: 'APPROVED',
            carId
        });

        const label = formatCarLabel({
            carId,
            plateNumber: reqData.plateNumber,
            plateCode,
            emirate: reqData.emirate
        });

        await logAction(currentUserData, 'CREATE_CAR', {
            targetId: carId,
            targetName: label,
            text: t('requests.carCreatedAndAssigned')
        });

        await logAction(currentUserData, 'APPROVE_LINK', {
            targetId: carId,
            targetName: label,
            assigneeId: reqData.userId,
            text: t('requests.linkApproved')
        });

        showMessage(t('requests.carCreatedAndAssigned'), 'success', 'dashboard');
        fetchRequests();
        updateRequestsBadge();
    } catch (error) {
        showMessage(error.message, 'error', 'dashboard');
    } finally {
        unlockUI();
    }
}

async function handleReject(reqId, reqData) {
    if (!isAdmin(currentUserData)) return;

    const typeLabel = reqData.type === 'LINK' ? t('requests.typeLink') : t('requests.typeUnlink');
    if (!confirm(t('requests.rejectConfirm', { type: typeLabel, userName: reqData.userName }))) {
        return;
    }

    lockUI();
    try {
        await updateDoc(doc(db, 'requests', reqId), { status: 'REJECTED' });

        await logAction(currentUserData, 'REJECT_REQUEST', {
            targetId: reqId,
            targetName: reqData.userName,
            text: t('requests.rejected')
        });

        showMessage(t('requests.rejected'), 'warning', 'dashboard');
        fetchRequests();
        updateRequestsBadge();
    } catch (error) {
        showMessage(error.message, 'error', 'dashboard');
    } finally {
        unlockUI();
    }
}

// دالة createLinkRequest تم نقلها إلى cars.js
// هذه الدالة محفوظة للتوافق مع الكود القديم، لكنها غير مستخدمة حالياً

export async function createUnlinkRequest(carId, carData) {
    if (!isActiveUser(currentUserData)) return;
    if (!confirm(t('cars.unlinkRequestSent'))) return;

    lockUI();
    try {
        const label = formatCarLabel(carData);

        await addDoc(collection(db, 'requests'), {
            type: 'UNLINK',
            userId: currentUserData.uid,
            userName: currentUserData.username,
            carId: carId,
            plateNumber: carData.plateNumber,
            plateCode: carData.plateCode,
            emirate: carData.emirate,
            status: 'PENDING',
            timestamp: serverTimestamp()
        });

        await logAction(currentUserData, 'REQUEST_UNLINK', {
            targetId: carId,
            targetName: label,
            text: t('cars.unlinkRequestSent')
        });

        showMessage(t('cars.unlinkRequestSent'), 'success', 'dashboard');
        updateRequestsBadge();
    } catch (error) {
        showMessage(error.message, 'error', 'dashboard');
    } finally {
        unlockUI();
    }
}