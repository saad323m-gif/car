import { db } from "./firebase.js";
import {
    collection, doc, getDoc, getDocs, setDoc, query, where, orderBy,
    limit, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import {
    showMessage, formatDateTime, formatCarLabel, isAdmin, isActiveUser,
    renderAccessDenied, escapeHtml, escapeAttribute, sanitizePlainText
} from "./utils.js";

let currentUserData = null;
let activeAdminFilter = 'all';

export const setViolationsCurrentUser = (data) => {
    currentUserData = data;
};

function normalizePlateIdentifier(plateNumber, plateCode, emirate) {
    return `${plateNumber}-${plateCode.toLowerCase()}-${emirate.toLowerCase()}`;
}

function parseDubaiDateTime(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const date = new Date(`${value}:00+04:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toDubaiDateTimeInput(value) {
    const source = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value || Date.now());
    const time = source.getTime() + (4 * 60 * 60 * 1000);
    return new Date(time).toISOString().slice(0, 16);
}

function isAssignmentActiveAt(assignment, violationAt) {
    if (!assignment || !assignment.startTime) return false;
    const start = assignment.startTime.toDate ? assignment.startTime.toDate() : new Date(assignment.startTime);
    const end = assignment.endTime
        ? (assignment.endTime.toDate ? assignment.endTime.toDate() : new Date(assignment.endTime))
        : null;
    const instant = violationAt instanceof Date ? violationAt : new Date(violationAt);
    return start.getTime() <= instant.getTime() && (!end || end.getTime() > instant.getTime());
}

function matchStatusLabel(status) {
    const labels = {
        AUTO_LINKED: 'Automatically Linked',
        NO_CAR: 'Car Not Found',
        NO_ASSIGNMENT: 'No Assignment at This Time',
        REVIEW_REQUIRED: 'Review Required'
    };
    return labels[status] || 'Unknown Status';
}

function settlementStatusLabel(status) {
    return status === 'SETTLED' ? 'Settled' : 'Unsettled';
}

function settlementMethodLabel(method) {
    const labels = {
        PAYMENT: 'Official Payment',
        OFFICIAL_OBJECTION: 'Official Objection',
        OTHER: 'Other Official Settlement'
    };
    return labels[method] || 'Not specified';
}

function statusClass(status) {
    const classes = {
        AUTO_LINKED: 'status-linked',
        NO_CAR: 'status-no-car',
        NO_ASSIGNMENT: 'status-no-assignment',
        REVIEW_REQUIRED: 'status-review'
    };
    return classes[status] || 'status-review';
}

function settlementClass(status) {
    return status === 'SETTLED' ? 'settlement-settled' : 'settlement-unsettled';
}

function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatAmount(value) {
    const amount = safeNumber(value);
    if (amount === 0) return 'Not specified';
    return amount.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getAreaId(prefix, token) {
    return `${prefix}-${String(token).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

export function renderViolationsView() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    container.innerHTML = `
        <section class="violations-page">
            <div class="violations-page-heading">
                <div>
                    <h2>Violations Management</h2>
                    <p class="violations-page-subtitle">Add a violation once. The system identifies the car and the assignment active at that time.</p>
                </div>
                <button type="button" class="btn-add-toggle" id="toggle-violation-form">+ Add Violation</button>
            </div>
            <div class="divider"></div>
            <div id="violation-form-wrapper" class="hidden-form violations-form-wrapper">
                ${renderViolationFormHtml()}
            </div>
            <div class="violations-filter-bar" id="violations-filter-bar">
                <button type="button" class="filter-btn active" data-violation-filter="all">All</button>
                <button type="button" class="filter-btn" data-violation-filter="AUTO_LINKED">Linked</button>
                <button type="button" class="filter-btn" data-violation-filter="NO_CAR">Car Not Found</button>
                <button type="button" class="filter-btn" data-violation-filter="NO_ASSIGNMENT">No Assignment</button>
                <button type="button" class="filter-btn" data-violation-filter="REVIEW_REQUIRED">Review Required</button>
                <button type="button" class="filter-btn" data-violation-filter="UNSETTLED">Unsettled</button>
                <button type="button" class="filter-btn" data-violation-filter="SETTLED">Settled</button>
            </div>
            <div id="violations-admin-list" class="violations-list">
                <p class="loading-text">Loading violations...</p>
            </div>
        </section>
    `;

    const formWrapper = document.getElementById('violation-form-wrapper');
    const toggleButton = document.getElementById('toggle-violation-form');
    const form = document.getElementById('add-violation-form');

    if (toggleButton && formWrapper) {
        toggleButton.addEventListener('click', () => {
            formWrapper.classList.toggle('hidden-form');
            if (!formWrapper.classList.contains('hidden-form')) {
                const timeInput = document.getElementById('violation-at');
                if (timeInput && !timeInput.value) timeInput.value = toDubaiDateTimeInput(new Date());
            }
        });
    }

    if (form) form.addEventListener('submit', handleAddViolation);

    document.querySelectorAll('[data-violation-filter]').forEach(button => {
        button.addEventListener('click', () => {
            activeAdminFilter = button.dataset.violationFilter || 'all';
            document.querySelectorAll('[data-violation-filter]').forEach(item => {
                item.classList.toggle('active', item === button);
            });
            loadAdminViolations();
        });
    });

    loadAdminViolations();
}

function renderViolationFormHtml() {
    return `
        <form id="add-violation-form" class="violation-form" novalidate>
            <div class="violation-form-intro">
                <strong>Matching keys</strong>
                <span>Plate number, code, emirate, and occurrence time determine the car and the active assignment.</span>
            </div>
            <div class="form-group">
                <label for="violation-plate-number">Plate Number</label>
                <input type="text" id="violation-plate-number" required pattern="\\d+" maxlength="6" inputmode="numeric" placeholder="e.g. 12345">
            </div>
            <div class="form-group">
                <label for="violation-plate-code">Plate Code</label>
                <input type="text" id="violation-plate-code" required maxlength="3" placeholder="e.g. A">
            </div>
            <div class="form-group">
                <label for="violation-emirate">Emirate</label>
                <select id="violation-emirate" required>
                    <option value="Abu Dhabi">Abu Dhabi</option>
                    <option value="Dubai">Dubai</option>
                    <option value="Sharjah">Sharjah</option>
                    <option value="Ajman">Ajman</option>
                    <option value="Fujairah">Fujairah</option>
                    <option value="Umm Al Quwain">Umm Al Quwain</option>
                    <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label for="violation-at">Violation Date & Time (UAE)</label>
                <input type="datetime-local" id="violation-at" required>
            </div>
            <div class="form-group">
                <label for="violation-type">Violation Type</label>
                <input type="text" id="violation-type" required maxlength="80" placeholder="e.g. Speeding">
            </div>
            <div class="form-group">
                <label for="violation-reference">Reference Number</label>
                <input type="text" id="violation-reference" maxlength="80" placeholder="Optional but recommended">
            </div>
            <div class="form-group">
                <label for="violation-location">Location</label>
                <input type="text" id="violation-location" maxlength="160" placeholder="Optional">
            </div>
            <div class="form-group">
                <label for="violation-amount">Amount</label>
                <input type="number" id="violation-amount" min="0" max="1000000" step="0.01" placeholder="Optional">
            </div>
            <div class="form-group full-width">
                <label for="violation-notes">Notes</label>
                <input type="text" id="violation-notes" maxlength="500" placeholder="Optional details">
            </div>
            <div class="form-group full-width violation-form-actions">
                <button type="submit" class="btn" id="submit-violation">Save and Match Violation</button>
                <button type="button" class="btn btn-secondary" id="cancel-violation-form">Cancel</button>
            </div>
        </form>
    `;
}

function readViolationForm() {
    const plateNumber = sanitizePlainText(document.getElementById('violation-plate-number')?.value || '', 6);
    const plateCode = sanitizePlainText(document.getElementById('violation-plate-code')?.value || '', 3).toUpperCase();
    const emirate = document.getElementById('violation-emirate')?.value || '';
    const violationAt = parseDubaiDateTime(document.getElementById('violation-at')?.value || '');
    const violationType = sanitizePlainText(document.getElementById('violation-type')?.value || '', 80);
    const referenceNumber = sanitizePlainText(document.getElementById('violation-reference')?.value || '', 80);
    const location = sanitizePlainText(document.getElementById('violation-location')?.value || '', 160);
    const amountInput = document.getElementById('violation-amount')?.value || '';
    const notes = sanitizePlainText(document.getElementById('violation-notes')?.value || '', 500);
    const amount = amountInput === '' ? 0 : Number(amountInput);

    if (!/^\d{1,6}$/.test(plateNumber)) throw new Error('Enter a valid plate number using digits only.');
    if (!plateCode || plateCode.length > 3) throw new Error('Enter a valid plate code.');
    if (!violationAt) throw new Error('Enter a valid violation date and time in UAE time.');
    if (!violationType || violationType.length < 2) throw new Error('Enter a violation type with at least two characters.');
    if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) throw new Error('Enter a valid amount or leave it blank.');

    return {
        plateNumber,
        plateCode,
        emirate,
        plateIdentifier: normalizePlateIdentifier(plateNumber, plateCode, emirate),
        violationAt,
        violationType,
        referenceNumber,
        location,
        amount,
        notes
    };
}

async function handleAddViolation(event) {
    event.preventDefault();
    if (!isAdmin(currentUserData)) return;

    const submitButton = document.getElementById('submit-violation');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Matching and saving...';
    }

    try {
        const data = readViolationForm();
        if (data.referenceNumber) {
            const duplicateQuery = query(collection(db, 'violations'), where('referenceNumber', '==', data.referenceNumber), limit(1));
            const duplicateSnap = await getDocs(duplicateQuery);
            if (!duplicateSnap.empty) throw new Error('A violation with this reference number already exists.');
        }

        const matchingCars = await getDocs(query(
            collection(db, 'cars'),
            where('plateIdentifier', '==', data.plateIdentifier),
            limit(2)
        ));

        let candidateCarRef = null;

        if (matchingCars.size === 1) {
            candidateCarRef = doc(db, 'cars', matchingCars.docs[0].id);
        }

        const result = await runTransaction(db, async transaction => {
            const counterRef = doc(db, 'counters', 'violationId');
            const counterSnap = await transaction.get(counterRef);
            const count = counterSnap.exists() ? Number(counterSnap.data().count || 0) + 1 : 1;
            const violationId = `VIO-${String(count).padStart(6, '0')}`;

            let carId = null;
            let carLabel = '';
            let assignmentId = null;
            let userId = null;
            let userName = null;
            let matchStatus = 'NO_CAR';

            if (matchingCars.size > 1) {
                matchStatus = 'REVIEW_REQUIRED';
            } else if (candidateCarRef) {
                const freshCarSnap = await transaction.get(candidateCarRef);
                if (freshCarSnap.exists() && freshCarSnap.data().plateIdentifier === data.plateIdentifier) {
                    const freshCar = freshCarSnap.data();
                    carId = freshCarSnap.id;
                    carLabel = formatCarLabel(freshCar);
                    matchStatus = 'NO_ASSIGNMENT';

                    const freshAssignmentQuery = query(
                        collection(db, 'cars', freshCarSnap.id, 'assignments'),
                        where('startTime', '<=', data.violationAt),
                        orderBy('startTime', 'desc'),
                        limit(10)
                    );
                    const assignmentSnap = await transaction.get(freshAssignmentQuery);
                    const matchingAssignment = assignmentSnap.docs.find(item => isAssignmentActiveAt(item.data(), data.violationAt));
                    if (matchingAssignment) {
                        const assignment = matchingAssignment.data();
                        assignmentId = matchingAssignment.id;
                        userId = assignment.userId;
                        userName = assignment.userName;
                        matchStatus = 'AUTO_LINKED';
                    }
                } else {
                    matchStatus = 'NO_CAR';
                }
            }

            const violationRef = doc(db, 'violations', violationId);
            transaction.set(counterRef, { count });
            transaction.set(violationRef, {
                violationId,
                referenceNumber: data.referenceNumber,
                plateNumber: data.plateNumber,
                plateCode: data.plateCode,
                emirate: data.emirate,
                plateIdentifier: data.plateIdentifier,
                violationAt: data.violationAt,
                violationType: data.violationType,
                location: data.location,
                amount: data.amount,
                notes: data.notes,
                carId,
                carLabel,
                assignmentId,
                userId,
                userName,
                matchStatus,
                settlementStatus: 'UNSETTLED',
                settlementMethod: null,
                settlementNotes: '',
                settledAt: null,
                settledBy: null,
                settledByName: null,
                createdBy: currentUserData.uid,
                createdByName: currentUserData.username,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                reviewNote: ''
            });

            return { violationId, carId, carLabel, assignmentId, userId, userName, matchStatus };
        });

        const targetName = result.carLabel || `${data.plateNumber} ${data.plateCode} ${data.emirate}`;
        const assignmentDetails = result.userName ? ` Linked to ${result.userName}.` : '';
        await logAction(currentUserData, 'CREATE_VIOLATION', {
            targetId: result.violationId,
            targetName,
            assigneeId: result.userId,
            text: `Created violation ${result.violationId}: ${matchStatusLabel(result.matchStatus)}.${assignmentDetails}`
        });

        const form = document.getElementById('add-violation-form');
        if (form) form.reset();
        const wrapper = document.getElementById('violation-form-wrapper');
        if (wrapper) wrapper.classList.add('hidden-form');
        showMessage(`Violation ${result.violationId} saved: ${matchStatusLabel(result.matchStatus)}.`, result.matchStatus === 'AUTO_LINKED' ? 'success' : 'warning', 'dashboard');
        loadAdminViolations();
    } catch (error) {
        console.error('Save violation failed:', error);
        showMessage(error.message || 'Could not save the violation. Verify all entered details and try again.', 'error', 'dashboard');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Save and Match Violation';
        }
    }
}

async function loadAdminViolations() {
    const container = document.getElementById('violations-admin-list');
    if (!container || !isAdmin(currentUserData)) return;

    container.innerHTML = '<p class="loading-text">Loading violations...</p>';
    try {
        const snapshot = await getDocs(query(collection(db, 'violations'), orderBy('violationAt', 'desc'), limit(100)));
        const violations = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
        const filtered = violations.filter(item => {
            if (activeAdminFilter === 'all') return true;
            if (activeAdminFilter === 'UNSETTLED' || activeAdminFilter === 'SETTLED') {
                return item.settlementStatus === activeAdminFilter;
            }
            return item.matchStatus === activeAdminFilter;
        });
        renderViolationRecords(container, filtered, { scope: 'admin' });
    } catch (error) {
        console.error('Load violations failed:', error);
        container.innerHTML = '<p class="error">Unable to load violations. Please try again.</p>';
    }
}

export async function renderCarViolations(carId, carData) {
    const areaId = getAreaId('violations-area', carId);
    const container = document.getElementById(areaId);
    if (!container || !isActiveUser(currentUserData)) return;

    container.style.display = 'block';
    container.innerHTML = '<p class="loading-text">Loading violations...</p>';

    try {
        const violationQuery = isAdmin(currentUserData)
            ? query(collection(db, 'violations'), where('carId', '==', carId), limit(100))
            : query(
                collection(db, 'violations'),
                where('userId', '==', currentUserData.uid),
                where('matchStatus', '==', 'AUTO_LINKED'),
                limit(100)
            );
        const snapshot = await getDocs(violationQuery);
        const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
            .filter(item => isAdmin(currentUserData) || item.carId === carId)
            .sort((first, second) => getViolationTime(second) - getViolationTime(first));
        renderViolationRecords(container, records, {
            scope: isAdmin(currentUserData) ? 'admin' : 'user',
            title: `Violations for ${formatCarLabel(carData)}`
        });
    } catch (error) {
        console.error('Load car violations failed:', error);
        container.innerHTML = '<p class="error">Unable to load violations for this car.</p>';
    }
}

export async function renderUserViolations(userId, targetContainerId, title = 'My Violations') {
    const container = document.getElementById(targetContainerId);
    if (!container || !isActiveUser(currentUserData)) return;
    if (!isAdmin(currentUserData) && currentUserData.uid !== userId) {
        renderAccessDenied();
        return;
    }

    container.style.display = 'block';
    container.innerHTML = '<p class="loading-text">Loading violations...</p>';

    try {
        const violationQuery = isAdmin(currentUserData)
            ? query(collection(db, 'violations'), where('userId', '==', userId), limit(100))
            : query(
                collection(db, 'violations'),
                where('userId', '==', currentUserData.uid),
                where('matchStatus', '==', 'AUTO_LINKED'),
                limit(100)
            );
        const snapshot = await getDocs(violationQuery);
        const records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
            .filter(item => isAdmin(currentUserData) || item.matchStatus === 'AUTO_LINKED')
            .sort((first, second) => getViolationTime(second) - getViolationTime(first));
        renderViolationRecords(container, records, {
            scope: isAdmin(currentUserData) ? 'admin' : 'user',
            title
        });
    } catch (error) {
        console.error('Load user violations failed:', error);
        container.innerHTML = '<p class="error">Unable to load your violations.</p>';
    }
}

function getViolationTime(record) {
    const value = record?.violationAt;
    const date = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value || 0);
    return date.getTime();
}

function renderViolationRecords(container, records, options = {}) {
    if (!container) return;
    const title = options.title ? `<h4 class="violations-list-title">${escapeHtml(options.title)}</h4>` : '';
    if (!records.length) {
        container.innerHTML = `${title}<p class="history-item">No violations found.</p>`;
        return;
    }

    container.innerHTML = `${title}<div class="violation-records">${records.map(record => renderViolationRecordHtml(record, options.scope)).join('')}</div>`;
    records.forEach(record => bindViolationRecordActions(record, container));
}

function renderViolationRecordHtml(record, scope) {
    const canSettle = scope === 'admin' && record.settlementStatus !== 'SETTLED';
    const settlementDetails = record.settlementStatus === 'SETTLED'
        ? `<div class="violation-settlement-details">
                <span>Method: ${escapeHtml(settlementMethodLabel(record.settlementMethod))}</span>
                <span>Settled by: ${escapeHtml(record.settledByName || 'Administrator')}</span>
                <span>On: ${escapeHtml(formatDateTime(record.settledAt))}</span>
                <span>Note: ${escapeHtml(record.settlementNotes || '')}</span>
           </div>`
        : '';
    const assignee = record.userName || 'No linked driver';
    const car = record.carLabel || `${record.plateNumber || ''} ${record.plateCode || ''} ${record.emirate || ''}`.trim();
    const settlementAction = canSettle
        ? `<button type="button" class="action-btn action-btn-settle" data-settle-violation="${escapeAttribute(record.id)}">Mark as Settled</button>`
        : '';

    return `
        <article class="violation-record" id="violation-${escapeAttribute(record.id)}">
            <div class="violation-record-topline">
                <strong>${escapeHtml(record.violationId || record.id)}</strong>
                <span class="violation-status ${statusClass(record.matchStatus)}">${escapeHtml(matchStatusLabel(record.matchStatus))}</span>
                <span class="settlement-status ${settlementClass(record.settlementStatus)}">${escapeHtml(settlementStatusLabel(record.settlementStatus))}</span>
            </div>
            <div class="violation-record-grid">
                <div><span>Occurred</span><strong>${escapeHtml(formatDateTime(record.violationAt))}</strong></div>
                <div><span>Type</span><strong>${escapeHtml(record.violationType || 'N/A')}</strong></div>
                <div><span>Vehicle</span><strong>${escapeHtml(car || 'Not matched')}</strong></div>
                <div><span>Driver</span><strong>${escapeHtml(assignee)}</strong></div>
                <div><span>Reference</span><strong>${escapeHtml(record.referenceNumber || 'Not specified')}</strong></div>
                <div><span>Amount</span><strong>${escapeHtml(formatAmount(record.amount))}</strong></div>
                <div><span>Location</span><strong>${escapeHtml(record.location || 'Not specified')}</strong></div>
                <div><span>Assignment</span><strong>${escapeHtml(record.assignmentId || 'Not linked')}</strong></div>
            </div>
            ${record.notes ? `<p class="violation-notes">${escapeHtml(record.notes)}</p>` : ''}
            ${settlementDetails}
            ${settlementAction ? `<div class="violation-record-actions">${settlementAction}</div><div id="settlement-area-${escapeAttribute(record.id)}" class="settlement-area"></div>` : ''}
        </article>
    `;
}

function bindViolationRecordActions(record, container) {
    const settleButton = container.querySelector(`[data-settle-violation="${CSS.escape(record.id)}"]`);
    if (!settleButton) return;
    settleButton.addEventListener('click', () => renderSettlementForm(record));
}

function renderSettlementForm(record) {
    if (!isAdmin(currentUserData)) return;
    const area = document.getElementById(`settlement-area-${record.id}`);
    if (!area) return;

    area.innerHTML = `
        <form class="settlement-form" id="settlement-form-${escapeAttribute(record.id)}">
            <h5>Confirm Official Settlement</h5>
            <p>This action keeps the violation record and records that it was officially settled.</p>
            <div class="form-group">
                <label for="settlement-method-${escapeAttribute(record.id)}">Settlement Method</label>
                <select id="settlement-method-${escapeAttribute(record.id)}" required>
                    <option value="PAYMENT">Official Payment</option>
                    <option value="OFFICIAL_OBJECTION">Official Objection</option>
                    <option value="OTHER">Other Official Settlement</option>
                </select>
            </div>
            <div class="form-group full-width">
                <label for="settlement-notes-${escapeAttribute(record.id)}">Settlement Note</label>
                <input type="text" id="settlement-notes-${escapeAttribute(record.id)}" required maxlength="500" placeholder="Required: payment or official objection detail">
            </div>
            <div class="settlement-form-actions">
                <button type="submit" class="btn btn-sm btn-success">Confirm Settlement</button>
                <button type="button" class="btn btn-sm btn-secondary" id="cancel-settlement-${escapeAttribute(record.id)}">Cancel</button>
            </div>
        </form>
    `;

    const form = document.getElementById(`settlement-form-${record.id}`);
    const cancelButton = document.getElementById(`cancel-settlement-${record.id}`);
    if (form) {
        form.addEventListener('submit', event => {
            event.preventDefault();
            handleSettleViolation(record);
        });
    }
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            area.innerHTML = '';
        });
    }
}

async function handleSettleViolation(record) {
    if (!isAdmin(currentUserData) || record.settlementStatus === 'SETTLED') return;

    const methodElement = document.getElementById(`settlement-method-${record.id}`);
    const notesElement = document.getElementById(`settlement-notes-${record.id}`);
    const form = document.getElementById(`settlement-form-${record.id}`);
    const submitButton = form?.querySelector('button[type="submit"]');
    const settlementMethod = methodElement?.value || '';
    const settlementNotes = sanitizePlainText(notesElement?.value || '', 500);

    if (!['PAYMENT', 'OFFICIAL_OBJECTION', 'OTHER'].includes(settlementMethod) || !settlementNotes) {
        showMessage('Select a settlement method and enter a settlement note.', 'error', 'dashboard');
        return;
    }

    if (!window.confirm(`Confirm that violation ${record.violationId} has been officially settled? This record will remain visible as settled.`)) return;

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
    }

    try {
        await runTransaction(db, async transaction => {
            const violationRef = doc(db, 'violations', record.id);
            const currentSnap = await transaction.get(violationRef);
            if (!currentSnap.exists()) throw new Error('Violation record no longer exists.');
            const current = currentSnap.data();
            if (current.settlementStatus === 'SETTLED') throw new Error('This violation has already been settled.');
            transaction.update(violationRef, {
                settlementStatus: 'SETTLED',
                settlementMethod,
                settlementNotes,
                settledAt: serverTimestamp(),
                settledBy: currentUserData.uid,
                settledByName: currentUserData.username,
                updatedAt: serverTimestamp()
            });
        });

        await logAction(currentUserData, 'SETTLE_VIOLATION', {
            targetId: record.violationId || record.id,
            targetName: record.carLabel || `${record.plateNumber} ${record.plateCode}`,
            assigneeId: record.userId || null,
            text: `Settled violation ${record.violationId || record.id} by ${settlementMethodLabel(settlementMethod)}.`
        });

        showMessage(`Violation ${record.violationId} marked as settled.`, 'success', 'dashboard');
        refreshViolationSurfaces(record);
    } catch (error) {
        console.error('Settle violation failed:', error);
        showMessage(error.message || 'Could not update the settlement status. Please try again.', 'error', 'dashboard');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Confirm Settlement';
        }
    }
}

function refreshViolationSurfaces(record) {
    if (document.getElementById('violations-admin-list')) loadAdminViolations();
    if (record.carId) {
        const carArea = document.getElementById(getAreaId('violations-area', record.carId));
        if (carArea) {
            carArea.innerHTML = '<p class="loading-text">Refreshing violations...</p>';
            getDoc(doc(db, 'cars', record.carId)).then(carSnap => {
                if (carSnap.exists()) renderCarViolations(record.carId, carSnap.data());
            }).catch(() => {
                carArea.innerHTML = '<p class="error">Unable to refresh violations.</p>';
            });
        }
    }
}

export function renderMyViolationsView() {
    const container = document.getElementById('dashboard-container');
    if (!container || !isActiveUser(currentUserData)) return;
    container.innerHTML = `
        <section class="violations-page">
            <h2>My Violations</h2>
            <p class="violations-page-subtitle">Only violations automatically linked to your active or historical assignments are shown here.</p>
            <div class="divider"></div>
            <div id="my-violations-list" class="violations-list"><p class="loading-text">Loading your violations...</p></div>
        </section>
    `;
    renderUserViolations(currentUserData.uid, 'my-violations-list', 'My Linked Violations');
}
