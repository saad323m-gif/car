/**
 * Requests and responsibility-transfer workflows.
 * Auto Link remains intentional: the confirming user becomes responsible for the vehicle.
 */

import { db } from "./firebase.js";
import {
    collection, doc, getDoc, getDocs, addDoc, query, where, limit,
    serverTimestamp, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import {
    showMessage, isAdmin, isActiveUser, renderAccessDenied,
    formatDateTime, formatCarLabel, escapeHtml, sanitizePlainText
} from "./utils.js";
import { updateRequestsBadge } from "./app.js";
import {
    addNotificationToBatch, createAssignmentNotification, createReassignmentNotification,
    createUnlinkNotification
} from "./notifications.js";

let currentUserData = null;
export const setRequestsCurrentUser = data => {
    currentUserData = data;
};

export function renderRequestsView() {
    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    if (!container) return;

    container.innerHTML = `
        <h2>Pending User Requests</h2>
        <div class="divider"></div>
        <div id="requests-card-list" class="card-list" aria-live="polite">
            <p class="loading-text">Loading requests...</p>
        </div>
    `;
    fetchRequests();
}

async function fetchRequests() {
    if (!isAdmin(currentUserData)) return;
    const listContainer = document.getElementById('requests-card-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p class="loading-text">Loading requests...</p>';
    try {
        const requestsQuery = query(collection(db, 'requests'), where('status', '==', 'PENDING'));
        const snapshot = await getDocs(requestsQuery);
        if (snapshot.empty) {
            listContainer.innerHTML = '<p class="empty-state">No pending requests.</p>';
            return;
        }

        listContainer.innerHTML = '';
        snapshot.forEach(requestDoc => renderRequestCard(requestDoc.id, requestDoc.data()));
    } catch (error) {
        console.error('Load requests failed:', error);
        listContainer.innerHTML = '<p class="error">Unable to load requests. Please try again.</p>';
    }
}

function renderRequestCard(id, data) {
    const listContainer = document.getElementById('requests-card-list');
    if (!listContainer) return;

    const card = document.createElement('article');
    card.className = 'card border-blue request-card';
    card.id = `req-${id}`;

    const date = escapeHtml(formatDateTime(data.timestamp));
    const user = escapeHtml(data.userName || 'Unknown');
    const type = escapeHtml(data.type || 'REQUEST');
    const plate = escapeHtml(`${data.plateNumber || ''} ${data.plateCode || ''} (${data.emirate || 'N/A'})`);
    const carLabel = data.carId
        ? escapeHtml(formatCarLabel({
            carId: data.carId,
            plateNumber: data.plateNumber,
            plateCode: data.plateCode,
            emirate: data.emirate
        }))
        : plate;
    const isLink = data.type === 'LINK';

    card.innerHTML = `
        <div class="card-header request-header">
            <span class="card-title">${type} Request — ${user}</span>
            <div class="card-meta"><span class="status-pending">Pending</span></div>
        </div>
        <div class="card-body request-body">
            <div class="detail-list">
                <div class="detail-item"><span class="detail-label">Requested By</span><span class="detail-value">${user}</span></div>
                <div class="detail-item"><span class="detail-label">${isLink ? 'Plate Details' : 'Car'}</span><span class="detail-value">${isLink ? plate : carLabel}</span></div>
                <div class="detail-item"><span class="detail-label">Submitted</span><span class="detail-value">${date}</span></div>
            </div>
            <div class="action-buttons request-actions">
                <button class="btn btn-sm btn-success" type="button" id="approve-req-${id}">${isLink ? 'Approve' : 'Approve Unlink'}</button>
                <button class="btn btn-sm btn-danger" type="button" id="reject-req-${id}">Reject</button>
            </div>
            <div id="approve-area-${id}" class="request-completion-area"></div>
        </div>
    `;
    listContainer.appendChild(card);

    document.getElementById(`approve-req-${id}`)?.addEventListener('click', () => handleApprove(id, data));
    document.getElementById(`reject-req-${id}`)?.addEventListener('click', () => handleReject(id, data));
}

function processedRequestFields(status, carId = undefined) {
    const fields = {
        status,
        processedAt: serverTimestamp(),
        processedBy: currentUserData.uid
    };
    if (carId !== undefined) fields.carId = carId;
    return fields;
}

async function handleApprove(reqId, reqData) {
    if (!isAdmin(currentUserData)) return;

    try {
        const requestRef = doc(db, 'requests', reqId);
        const requestSnap = await getDoc(requestRef);
        if (!requestSnap.exists() || requestSnap.data().status !== 'PENDING') {
            throw new Error('This request has already been processed.');
        }

        if (reqData.type === 'UNLINK') {
            await approveUnlink(requestRef, reqId, reqData);
        } else if (reqData.type === 'LINK') {
            await approveLink(requestRef, reqId, reqData);
        }
    } catch (error) {
        console.error('Approve request failed:', error);
        showMessage('Unable to approve this request. Please refresh and try again.', 'error', 'dashboard');
    }
}

async function approveUnlink(requestRef, reqId, reqData) {
    const carRef = doc(db, 'cars', reqData.carId);
    const carSnap = await getDoc(carRef);
    if (!carSnap.exists() || carSnap.data().currentUserId !== reqData.userId) {
        throw new Error('The vehicle is no longer assigned to this requester.');
    }

    const carData = carSnap.data();
    const label = formatCarLabel(carData);
    const openAssignmentQuery = query(
        collection(db, 'cars', reqData.carId, 'assignments'),
        where('userId', '==', reqData.userId),
        where('endTime', '==', null),
        limit(1)
    );
    const assignmentSnap = await getDocs(openAssignmentQuery);
    const batch = writeBatch(db);
    batch.update(carRef, {
        currentUserId: null,
        currentUserName: null,
        updatedAt: serverTimestamp()
    });
    if (!assignmentSnap.empty) {
        batch.update(doc(db, 'cars', reqData.carId, 'assignments', assignmentSnap.docs[0].id), {
            endTime: serverTimestamp()
        });
    }
    batch.update(requestRef, processedRequestFields('APPROVED', reqData.carId));
    if (reqData.requestId) {
        batch.delete(doc(db, 'cars', reqData.carId, 'unlinkGuards', reqData.userId));
    }
    addNotificationToBatch(batch, createUnlinkNotification({
        recipientId: reqData.userId,
        carData,
        actorId: currentUserData.uid,
        actorName: currentUserData.username
    }));
    await batch.commit();

    await logAction(currentUserData, 'APPROVE_UNLINK', {
        targetId: reqData.carId,
        targetName: label,
        assigneeId: reqData.userId,
        text: `Approved unlink of ${label} for ${reqData.userName}`
    });
    showMessage('Unlink request approved. The car is now unassigned.', 'success', 'dashboard');
    await refreshRequests();
}

async function approveLink(requestRef, reqId, reqData) {
    const plateId = `${reqData.plateNumber}-${reqData.plateCode.toLowerCase()}-${reqData.emirate.toLowerCase()}`;
    const existingCarQuery = query(collection(db, 'cars'), where('plateIdentifier', '==', plateId), limit(1));
    const carSnap = await getDocs(existingCarQuery);

    if (carSnap.empty) {
        renderCompleteCarForm(reqId, reqData);
        return;
    }

    const carDoc = carSnap.docs[0];
    const carData = carDoc.data();
    const label = formatCarLabel(carData);
    const carRef = doc(db, 'cars', carDoc.id);
    const batch = writeBatch(db);
    const previousUserId = carData.currentUserId || null;

    if (previousUserId) {
        const previousAssignmentQuery = query(
            collection(db, 'cars', carDoc.id, 'assignments'),
            where('userId', '==', carData.currentUserId),
            where('endTime', '==', null),
            limit(1)
        );
        const previousAssignmentSnap = await getDocs(previousAssignmentQuery);
        if (!previousAssignmentSnap.empty) {
            batch.update(doc(db, 'cars', carDoc.id, 'assignments', previousAssignmentSnap.docs[0].id), {
                endTime: serverTimestamp()
            });
        }
    }

    batch.update(carRef, {
        currentUserId: reqData.userId,
        currentUserName: reqData.userName,
        updatedAt: serverTimestamp()
    });
    batch.set(doc(collection(db, 'cars', carDoc.id, 'assignments')), {
        userId: reqData.userId,
        userName: reqData.userName,
        startTime: serverTimestamp(),
        endTime: null
    });
    batch.update(requestRef, processedRequestFields('APPROVED', carDoc.id));
    if (previousUserId && previousUserId !== reqData.userId) {
        addNotificationToBatch(batch, createReassignmentNotification({
            recipientId: previousUserId,
            carData,
            actorId: currentUserData.uid,
            actorName: currentUserData.username
        }));
    }
    addNotificationToBatch(batch, createAssignmentNotification({
        recipientId: reqData.userId,
        carData,
        actorId: currentUserData.uid,
        actorName: currentUserData.username
    }));
    await batch.commit();

    await logAction(currentUserData, 'APPROVE_LINK', {
        targetId: carDoc.id,
        targetName: label,
        assigneeId: reqData.userId,
        text: `Approved link of ${label} for ${reqData.userName}`
    });
    showMessage('Link request approved. The car has been assigned to the user.', 'success', 'dashboard');
    await refreshRequests();
}

function renderCompleteCarForm(reqId, reqData) {
    const area = document.getElementById(`approve-area-${reqId}`);
    if (!area) return;

    area.innerHTML = `
        <h4>Complete Car Details</h4>
        <form id="complete-car-${reqId}" class="edit-car-form">
            <div class="form-group"><label>Type (Make)</label><input type="text" id="cc-type-${reqId}" required maxlength="80"></div>
            <div class="form-group"><label>Owner Name</label><input type="text" id="cc-owner-${reqId}" required maxlength="80"></div>
            <div class="form-group"><label>Owner Traffic Code (Optional)</label><input type="text" id="cc-owner-traffic-code-${reqId}" maxlength="60" inputmode="text"></div>
            <div class="form-group"><label>VIN</label><input type="text" id="cc-vin-${reqId}" required maxlength="40"></div>
            <div class="form-group"><label>Manufacture Year</label><input type="number" id="cc-year-${reqId}" required min="1900" max="2100"></div>
            <div class="form-group"><label>License Expiry</label><input type="date" id="cc-lic-${reqId}" required></div>
            <div class="form-group"><label>Insurance Expiry</label><input type="date" id="cc-ins-${reqId}" required></div>
            <div class="form-group full-width"><label>Notes</label><input type="text" id="cc-notes-${reqId}" maxlength="500"></div>
            <div class="form-group full-width"><button type="submit" class="btn btn-sm btn-success">Save & Assign</button></div>
        </form>
    `;
    area.style.display = 'block';
    document.getElementById(`complete-car-${reqId}`)?.addEventListener('submit', event => {
        event.preventDefault();
        handleCompleteAndAssign(reqId, reqData);
    });
}

async function handleCompleteAndAssign(reqId, reqData) {
    if (!isAdmin(currentUserData)) return;

    const type = sanitizePlainText(document.getElementById(`cc-type-${reqId}`)?.value, 80);
    const owner = sanitizePlainText(document.getElementById(`cc-owner-${reqId}`)?.value, 80);
    const ownerTrafficCode = sanitizePlainText(document.getElementById(`cc-owner-traffic-code-${reqId}`)?.value, 60);
    const vin = sanitizePlainText(document.getElementById(`cc-vin-${reqId}`)?.value, 40).toUpperCase();
    const year = Number.parseInt(document.getElementById(`cc-year-${reqId}`)?.value, 10);
    const licenseExpiry = document.getElementById(`cc-lic-${reqId}`)?.value;
    const insuranceExpiry = document.getElementById(`cc-ins-${reqId}`)?.value;
    const notes = sanitizePlainText(document.getElementById(`cc-notes-${reqId}`)?.value, 500);

    if (!type || !owner || vin.length < 5 || !licenseExpiry || !insuranceExpiry || Number.isNaN(year) || year < 1900 || year > 2100) {
        showMessage('Please complete all car details with valid values.', 'error', 'dashboard');
        return;
    }

    try {
        const requestRef = doc(db, 'requests', reqId);
        const requestSnap = await getDoc(requestRef);
        if (!requestSnap.exists() || requestSnap.data().status !== 'PENDING') throw new Error('Request already processed.');

        const vinQuery = query(collection(db, 'cars'), where('vin', '==', vin), limit(1));
        if (!(await getDocs(vinQuery)).empty) {
            showMessage('This VIN already exists.', 'error', 'dashboard');
            return;
        }

        const counterRef = doc(db, 'counters', 'carId');
        const count = await runTransaction(db, async transaction => {
            const counterDoc = await transaction.get(counterRef);
            const nextCount = counterDoc.exists() ? Number(counterDoc.data().count || 0) + 1 : 1;
            transaction.set(counterRef, { count: nextCount }, { merge: true });
            return nextCount;
        });
        const carId = `UAE-${String(count).padStart(3, '0')}`;
        const plateCode = sanitizePlainText(reqData.plateCode, 3).toUpperCase();
        const plateNumber = sanitizePlainText(reqData.plateNumber, 6);
        const plateIdentifier = `${plateNumber}-${plateCode.toLowerCase()}-${reqData.emirate.toLowerCase()}`;
        const carRef = doc(db, 'cars', carId);
        const batch = writeBatch(db);

        batch.set(carRef, {
            carId,
            plateNumber,
            plateCode,
            emirate: reqData.emirate,
            plateIdentifier,
            type,
            ownerName: owner,
            ownerTrafficCode,
            vin,
            manufactureYear: year,
            licenseExpiry: new Date(licenseExpiry),
            insuranceExpiry: new Date(insuranceExpiry),
            notes,
            currentUserId: reqData.userId,
            currentUserName: reqData.userName,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        batch.set(doc(collection(db, 'cars', carId, 'assignments')), {
            userId: reqData.userId,
            userName: reqData.userName,
            startTime: serverTimestamp(),
            endTime: null
        });
        batch.update(requestRef, processedRequestFields('APPROVED', carId));
        addNotificationToBatch(batch, createAssignmentNotification({
            recipientId: reqData.userId,
            carData: { carId, plateNumber, plateCode, emirate: reqData.emirate },
            actorId: currentUserData.uid,
            actorName: currentUserData.username
        }));
        await batch.commit();

        const label = formatCarLabel({ carId, plateNumber, plateCode, emirate: reqData.emirate });
        await logAction(currentUserData, 'CREATE_CAR', { targetId: carId, targetName: label, text: `Created car ${label} via request` });
        await logAction(currentUserData, 'APPROVE_LINK', { targetId: carId, targetName: label, assigneeId: reqData.userId, text: `Approved link of ${label} for ${reqData.userName}` });
        showMessage('New car created and assigned to the requester successfully.', 'success', 'dashboard');
        await refreshRequests();
    } catch (error) {
        console.error('Complete request failed:', error);
        showMessage('Unable to create and assign this car. Please try again.', 'error', 'dashboard');
    }
}

async function handleReject(reqId, reqData) {
    if (!isAdmin(currentUserData)) return;
    if (!confirm(`Reject the ${reqData.type} request from ${reqData.userName}?`)) return;

    try {
        const requestRef = doc(db, 'requests', reqId);
        const requestSnap = await getDoc(requestRef);
        if (!requestSnap.exists() || requestSnap.data().status !== 'PENDING') throw new Error('Request already processed.');

        const batch = writeBatch(db);
        batch.update(requestRef, processedRequestFields('REJECTED'));
        if (reqData.type === 'UNLINK' && reqData.requestId && reqData.carId) {
            batch.delete(doc(db, 'cars', reqData.carId, 'unlinkGuards', reqData.userId));
        }
        await batch.commit();
        await logAction(currentUserData, 'REJECT_REQUEST', {
            targetId: reqId,
            targetName: reqData.userName,
            text: `Rejected ${reqData.type} request from ${reqData.userName}`
        });
        showMessage('The request has been rejected.', 'warning', 'dashboard');
        await refreshRequests();
    } catch (error) {
        console.error('Reject request failed:', error);
        showMessage('Unable to reject this request. Please try again.', 'error', 'dashboard');
    }
}

export async function createLinkRequest(event) {
    event.preventDefault();
    if (!isActiveUser(currentUserData)) return;

    const button = document.getElementById('btn-submit-req');
    const form = document.getElementById('request-car-form');
    const wrapper = document.getElementById('request-car-form-wrapper');
    if (!button || !form) return;

    const plateNumber = sanitizePlainText(document.getElementById('req-plate-num')?.value, 6);
    const plateCode = sanitizePlainText(document.getElementById('req-plate-code')?.value, 3).toUpperCase();
    const emirate = document.getElementById('req-emirate')?.value;
    if (!/^\d{1,6}$/.test(plateNumber) || !plateCode || !emirate) {
        showMessage('Enter a valid plate number, code and emirate.', 'error', 'dashboard');
        return;
    }

    button.disabled = true;
    button.textContent = 'Processing...';
    const plateIdentifier = `${plateNumber}-${plateCode.toLowerCase()}-${emirate.toLowerCase()}`;

    try {
        const carQuery = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier), limit(1));
        const carSnap = await getDocs(carQuery);
        if (carSnap.empty) {
            await addDoc(collection(db, 'requests'), {
                type: 'LINK',
                userId: currentUserData.uid,
                userName: currentUserData.username,
                plateNumber,
                plateCode,
                emirate,
                status: 'PENDING',
                timestamp: serverTimestamp()
            });
            await logAction(currentUserData, 'REQUEST_LINK', {
                targetName: `${plateNumber} ${plateCode} (${emirate})`,
                text: `Requested link for plate ${plateNumber} ${plateCode} (${emirate})`
            });
            showMessage('Link request sent to admin. The plate was not found, so car details must be completed first.', 'success', 'dashboard');
            form.reset();
            wrapper?.classList.add('hidden-form');
            await updateRequestsBadge();
            return;
        }

        const carDoc = carSnap.docs[0];
        const carData = carDoc.data();
        if (carData.currentUserId === currentUserData.uid) {
            showMessage('This car is already assigned to you.', 'warning', 'dashboard');
            return;
        }

        const label = formatCarLabel(carData);
        const previousUser = carData.currentUserName || 'no current assignee';
        const confirmed = confirm(
            `RESPONSIBILITY CONFIRMATION\n\n` +
            `Vehicle: ${label}\n` +
            `Current assignee: ${previousUser}\n\n` +
            `By continuing, you accept full responsibility for this vehicle and all related licence, insurance and usage obligations.\n\n` +
            `Do you want to link this vehicle to your account?`
        );
        if (!confirmed) {
            showMessage('Link cancelled. No assignment was changed.', 'warning', 'dashboard');
            return;
        }

        const carRef = doc(db, 'cars', carDoc.id);
        const batch = writeBatch(db);
        const previousUserId = carData.currentUserId || null;
        const notificationCarData = { ...carData, carId: carDoc.id };
        if (previousUserId) {
            const previousAssignmentQuery = query(
                collection(db, 'cars', carDoc.id, 'assignments'),
                where('userId', '==', carData.currentUserId),
                where('endTime', '==', null),
                limit(1)
            );
            const previousAssignmentSnap = await getDocs(previousAssignmentQuery);
            if (!previousAssignmentSnap.empty) {
                batch.update(doc(db, 'cars', carDoc.id, 'assignments', previousAssignmentSnap.docs[0].id), {
                    endTime: serverTimestamp()
                });
            }
        }
        batch.update(carRef, {
            currentUserId: currentUserData.uid,
            currentUserName: currentUserData.username,
            updatedAt: serverTimestamp()
        });
        batch.set(doc(collection(db, 'cars', carDoc.id, 'assignments')), {
            userId: currentUserData.uid,
            userName: currentUserData.username,
            startTime: serverTimestamp(),
            endTime: null
        });
        if (previousUserId) {
            addNotificationToBatch(batch, createReassignmentNotification({
                recipientId: previousUserId,
                carData: notificationCarData,
                actorId: currentUserData.uid,
                actorName: currentUserData.username
            }));
        }
        addNotificationToBatch(batch, createAssignmentNotification({
            recipientId: currentUserData.uid,
            carData: notificationCarData,
            actorId: currentUserData.uid,
            actorName: currentUserData.username
        }));
        await batch.commit();

        await logAction(currentUserData, 'AUTO_LINK_CONFIRMED', {
            targetId: carDoc.id,
            targetName: label,
            assigneeId: currentUserData.uid,
            text: `Responsibility accepted and vehicle linked to ${currentUserData.username}`
        });
        showMessage(`Car ${label} has been linked to you. You are now responsible for this vehicle.`, 'success', 'dashboard');
        form.reset();
        wrapper?.classList.add('hidden-form');
        const { renderCarsView } = await import('./cars.js');
        renderCarsView();
    } catch (error) {
        console.error('Link request failed:', error);
        showMessage('Unable to process this request. Please try again.', 'error', 'dashboard');
    } finally {
        button.disabled = false;
        button.textContent = 'Send Request';
    }
}

async function hasLegacyPendingUnlinkRequest(carId) {
    const ownRequestsQuery = query(
        collection(db, 'requests'),
        where('userId', '==', currentUserData.uid),
        limit(50)
    );
    const snapshot = await getDocs(ownRequestsQuery);
    return snapshot.docs.some(requestDoc => {
        const data = requestDoc.data();
        return data.type === 'UNLINK' && data.status === 'PENDING' && data.carId === carId;
    });
}

export async function createUnlinkRequest(carId, carData) {
    if (!isActiveUser(currentUserData)) return;
    if (!confirm('Send an unlink request to the administrator? The car remains assigned to you until approval.')) return;

    try {
        if (await hasLegacyPendingUnlinkRequest(carId)) {
            showMessage('A pending unlink request already exists for this car. Please wait for the administrator decision.', 'warning', 'dashboard');
            return;
        }

        const requestRef = doc(collection(db, 'requests'));
        const carRef = doc(db, 'cars', carId);
        const guardRef = doc(db, 'cars', carId, 'unlinkGuards', currentUserData.uid);
        const label = formatCarLabel(carData);

        await runTransaction(db, async transaction => {
            const carSnap = await transaction.get(carRef);
            const guardSnap = await transaction.get(guardRef);
            if (!carSnap.exists() || carSnap.data().currentUserId !== currentUserData.uid) {
                throw new Error('The car is no longer assigned to you.');
            }
            if (guardSnap.exists() && guardSnap.data().status === 'PENDING') {
                throw new Error('A pending unlink request already exists for this car. Please wait for the administrator decision.');
            }

            transaction.set(guardRef, {
                userId: currentUserData.uid,
                requestId: requestRef.id,
                status: 'PENDING',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            transaction.set(requestRef, {
                requestId: requestRef.id,
                type: 'UNLINK',
                userId: currentUserData.uid,
                userName: currentUserData.username,
                carId,
                plateNumber: sanitizePlainText(carData.plateNumber, 6),
                plateCode: sanitizePlainText(carData.plateCode, 3).toUpperCase(),
                emirate: carData.emirate,
                status: 'PENDING',
                timestamp: serverTimestamp()
            });
        });

        await logAction(currentUserData, 'REQUEST_UNLINK', {
            targetId: carId,
            targetName: label,
            text: `Requested unlink of ${label}`
        });
        showMessage('Unlink request sent to admin.', 'success', 'dashboard');
        await updateRequestsBadge();
    } catch (error) {
        console.error('Unlink request failed:', error);
        const message = error?.message === 'A pending unlink request already exists for this car. Please wait for the administrator decision.'
            ? error.message
            : 'Unable to create the unlink request. Please try again.';
        showMessage(message, 'error', 'dashboard');
    }
}

async function refreshRequests() {
    await fetchRequests();
    await updateRequestsBadge();
}
