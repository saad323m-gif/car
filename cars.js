/**
 * Cars Module - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { db } from "./firebase.js";
import {
    collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
    query, where, limit, startAfter, orderBy, runTransaction, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import { createLinkRequest, createUnlinkRequest } from "./requests.js";
import { renderCarViolations } from "./violations.js";
import {
    showMessage, handleFirebaseError, formatDateTime, formatDateOnly,
    formatPeriod, formatCarLabel, isAdmin, isActiveUser, renderAccessDenied,
    daysUntil, expiryClass, toDateInputValue, escapeHtml, escapeAttribute, sanitizePlainText
} from "./utils.js";

let currentUserData = null;
let lastVisibleCar = null;

export const setCarsCurrentUser = (data) => { currentUserData = data; };

export function renderCarsView() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    if (!isActiveUser(currentUserData)) {
        renderAccessDenied();
        return;
    }

    if (isAdmin(currentUserData)) {
        container.innerHTML = `
            <h2>Cars Management</h2>
            <div class="divider"></div>
            
            <div class="cars-filters" id="cars-filters">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter="expired">Expired</button>
                <button class="filter-btn" data-filter="warning">Expiring Soon</button>
                <button class="filter-btn" data-filter="assigned">Assigned</button>
                <button class="filter-btn" data-filter="unassigned">Unassigned</button>
            </div>

            <button class="btn-add-toggle" id="toggle-add-car">+ Add New Car</button>
            <div id="add-car-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
                <form id="add-car-form">
                    <div class="form-group">
                        <label>Plate Number (Digits)</label>
                        <input type="text" id="car-plate-num" required pattern="\\d+" maxlength="6" placeholder="e.g. 12345">
                    </div>
                    <div class="form-group">
                        <label>Plate Code</label>
                        <input type="text" id="car-plate-code" required maxlength="3" placeholder="e.g. A">
                    </div>
                    <div class="form-group">
                        <label>Emirate</label>
                        <select id="car-emirate" required>
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
                        <label>Type (Make)</label>
                        <input type="text" id="car-type" required placeholder="e.g. Toyota Camry">
                    </div>
                    <div class="form-group">
                        <label>Owner Name</label>
                        <input type="text" id="car-owner" required>
                    </div>
                    <div class="form-group">
                        <label>VIN</label>
                        <input type="text" id="car-vin" required placeholder="Vehicle Identification Number">
                    </div>
                    <div class="form-group">
                        <label>Manufacture Year</label>
                        <input type="number" id="car-year" required min="1900" max="2026" placeholder="e.g. 2020">
                    </div>
                    <div class="form-group">
                        <label>License Expiry</label>
                        <input type="date" id="car-license-exp" required>
                    </div>
                    <div class="form-group">
                        <label>Insurance Expiry</label>
                        <input type="date" id="car-insurance-exp" required>
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <input type="text" id="car-notes">
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn" id="btn-submit-car">Add Car</button>
                    </div>
                </form>
            </div>
            <h3>Cars List (Sorted by License Expiry)</h3>
            <div id="cars-card-list" class="card-list">
                <p class="loading-text">Loading cars...</p>
            </div>
            <div id="load-more-container" class="load-more-container"></div>
        `;

        const toggleAddCar = document.getElementById('toggle-add-car');
        const addCarForm = document.getElementById('add-car-form');
        if (toggleAddCar) {
            toggleAddCar.addEventListener('click', () => {
                const wrapper = document.getElementById('add-car-form-wrapper');
                if (wrapper) wrapper.classList.toggle('hidden-form');
            });
        }
        if (addCarForm) {
            addCarForm.addEventListener('submit', handleAddCar);
        }

        const activeFilter = sessionStorage.getItem('carsFilter') || 'all';
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === activeFilter);
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const filter = btn.dataset.filter;
                sessionStorage.setItem('carsFilter', filter);
                lastVisibleCar = null;
                fetchCars(false);
            });
        });

        lastVisibleCar = null;
        fetchCars(false);
    } else {
        container.innerHTML = `
            <h2>My Assigned Cars</h2>
            <div class="divider"></div>
            <button class="btn-add-toggle" id="toggle-request-car">+ Request to Use a Car</button>
            <div id="request-car-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
                <form id="request-car-form">
                    <div class="form-group">
                        <label>Plate Number</label>
                        <input type="text" id="req-plate-num" required pattern="\\d+" maxlength="6">
                    </div>
                    <div class="form-group">
                        <label>Plate Code</label>
                        <input type="text" id="req-plate-code" required maxlength="3">
                    </div>
                    <div class="form-group">
                        <label>Emirate</label>
                        <select id="req-emirate" required>
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
                        <button type="submit" class="btn" id="btn-submit-req">Send Request</button>
                    </div>
                </form>
            </div>
            <div id="cars-card-list" class="card-list"></div>
        `;

        const toggleRequestCar = document.getElementById('toggle-request-car');
        const requestCarForm = document.getElementById('request-car-form');
        if (toggleRequestCar) {
            toggleRequestCar.addEventListener('click', () => {
                const wrapper = document.getElementById('request-car-form-wrapper');
                if (wrapper) wrapper.classList.toggle('hidden-form');
            });
        }
        if (requestCarForm) {
            requestCarForm.addEventListener('submit', createLinkRequest);
        }
        fetchUserCars();
    }
}

async function generateCarId() {
    const counterRef = doc(db, 'counters', 'carId');
    const newCount = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        if (!counterDoc.exists()) {
            transaction.set(counterRef, { count: 1 });
            return 1;
        }
        const next = counterDoc.data().count + 1;
        transaction.update(counterRef, { count: next });
        return next;
    });
    return `UAE-${newCount.toString().padStart(3, '0')}`;
}

async function handleAddCar(e) {
    e.preventDefault();
    if (!isAdmin(currentUserData)) return;

    const submitBtn = document.getElementById('btn-submit-car');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Adding...';
    }

    const plateNumEl = document.getElementById('car-plate-num');
    const plateCodeEl = document.getElementById('car-plate-code');
    const emirateSelect = document.getElementById('car-emirate');
    const typeEl = document.getElementById('car-type');
    const ownerEl = document.getElementById('car-owner');
    const vinEl = document.getElementById('car-vin');
    const yearEl = document.getElementById('car-year');
    const licenseExpEl = document.getElementById('car-license-exp');
    const insuranceExpEl = document.getElementById('car-insurance-exp');
    const notesEl = document.getElementById('car-notes');

    if (!plateNumEl || !plateCodeEl || !emirateSelect || !typeEl || !ownerEl || !vinEl || !yearEl || !licenseExpEl || !insuranceExpEl) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Car';
        }
        showMessage('Error: Form elements not found.', 'error', 'dashboard');
        return;
    }

    const plateNum = sanitizePlainText(plateNumEl.value, 6);
    const plateCode = sanitizePlainText(plateCodeEl.value, 3).toUpperCase();
    const emirate = emirateSelect.value;
    const type = sanitizePlainText(typeEl.value, 80);
    const owner = sanitizePlainText(ownerEl.value, 80);
    const vin = sanitizePlainText(vinEl.value, 40).toUpperCase();
    const manufactureYear = parseInt(yearEl.value);
    const licenseExp = licenseExpEl.value;
    const insuranceExp = insuranceExpEl.value;
    const notes = notesEl ? sanitizePlainText(notesEl.value, 500) : '';

    if (isNaN(manufactureYear) || manufactureYear < 1900 || manufactureYear > 2026) {
        showMessage('Error: Please enter a valid manufacture year (1900-2026).', 'error', 'dashboard');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Car';
        }
        return;
    }

    const plateIdentifier = `${plateNum}-${plateCode.toLowerCase()}-${emirate.toLowerCase()}`;

    try {
        const plateQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier));
        const plateSnap = await getDocs(plateQ);
        if (!plateSnap.empty) throw new Error('This plate combination already exists.');

        const vinQ = query(collection(db, 'cars'), where('vin', '==', vin));
        const vinSnap = await getDocs(vinQ);
        if (!vinSnap.empty) throw new Error('This VIN already exists.');

        const carId = await generateCarId();

        await setDoc(doc(db, 'cars', carId), {
            carId,
            plateNumber: plateNum,
            plateCode,
            emirate,
            plateIdentifier,
            type,
            ownerName: owner,
            vin,
            manufactureYear,
            licenseExpiry: new Date(licenseExp),
            insuranceExpiry: new Date(insuranceExp),
            notes,
            currentUserId: null,
            currentUserName: null,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        await logAction(currentUserData, 'CREATE_CAR', {
            targetId: carId,
            targetName: formatCarLabel({ carId, plateNumber: plateNum, plateCode, emirate }),
            text: `Created car ${formatCarLabel({ carId, plateNumber: plateNum, plateCode, emirate })}`
        });

        showMessage('Car added successfully and is now available in the list.', 'success', 'dashboard');
        const addForm = document.getElementById('add-car-form');
        if (addForm) addForm.reset();
        const addWrapper = document.getElementById('add-car-form-wrapper');
        if (addWrapper) addWrapper.classList.add('hidden-form');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (error) {
        console.error('Create car failed:', error);
        showMessage('Could not add the car. Verify that the plate and VIN are unique, then try again.', 'error', 'dashboard');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Car';
        }
    }
}

async function fetchCars(loadMore = false) {
    if (!isAdmin(currentUserData)) return;

    const listContainer = document.getElementById('cars-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!listContainer) return;

    if (!loadMore) listContainer.innerHTML = '<p class="loading-text">Loading cars...</p>';

    try {
        let q;
        if (loadMore && lastVisibleCar) {
            q = query(collection(db, 'cars'), orderBy('licenseExpiry', 'asc'), startAfter(lastVisibleCar), limit(10));
        } else {
            q = query(collection(db, 'cars'), orderBy('licenseExpiry', 'asc'), limit(10));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            if (!loadMore) listContainer.innerHTML = '<p style="text-align:center; color:#666;">No cars found.</p>';
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleCar = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        const filter = sessionStorage.getItem('carsFilter') || 'all';
        let docs = snapshot.docs;

        if (filter === 'expired') {
            docs = docs.filter(d => {
                const data = d.data();
                return Math.min(daysUntil(data.licenseExpiry), daysUntil(data.insuranceExpiry)) < 0;
            });
        } else if (filter === 'warning') {
            docs = docs.filter(d => {
                const data = d.data();
                const minDiff = Math.min(daysUntil(data.licenseExpiry), daysUntil(data.insuranceExpiry));
                return minDiff >= 0 && minDiff <= 15;
            });
        } else if (filter === 'assigned') {
            docs = docs.filter(d => !!d.data().currentUserId);
        } else if (filter === 'unassigned') {
            docs = docs.filter(d => !d.data().currentUserId);
        }

        if (docs.length === 0 && !loadMore) {
            listContainer.innerHTML = '<p style="text-align:center; color:#666;">No cars match the current filter.</p>';
        } else {
            docs.forEach((d) => renderCarCard(d.id, d.data(), false));
        }

        if (loadMoreContainer) {
            if (snapshot.size === 10) {
                loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load More</button>';
                const loadMoreBtn = document.getElementById('load-more-btn');
                if (loadMoreBtn) {
                    loadMoreBtn.addEventListener('click', () => fetchCars(true));
                }
            } else {
                loadMoreContainer.innerHTML = '';
            }
        }

    } catch (error) {
        console.error('Load cars failed:', error);
        if (listContainer) {
            listContainer.innerHTML = '<p class="error">Unable to load cars. Please try again.</p>';
        }
    }
}

async function fetchUserCars() {
    if (!isActiveUser(currentUserData)) return;

    const listContainer = document.getElementById('cars-card-list');
    if (!listContainer) return;

    listContainer.innerHTML = '<p class="loading-text">Loading your cars...</p>';

    try {
        const q = query(collection(db, 'cars'), where('currentUserId', '==', currentUserData.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="text-align:center; color:#666;">No cars assigned to you currently.</p>';
            return;
        }

        listContainer.innerHTML = '';
        snapshot.forEach((d) => renderCarCard(d.id, d.data(), true));
    } catch (error) {
        console.error('Load user cars failed:', error);
        listContainer.innerHTML = '<p class="error">Unable to load your cars. Please try again.</p>';
    }
}

function renderCarCard(id, data, isUserView = false) {
    const listContainer = document.getElementById('cars-card-list');
    if (!listContainer) return;

    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${id}`;

    const licDiff = daysUntil(data.licenseExpiry);
    const insDiff = daysUntil(data.insuranceExpiry);
    const minDiff = Math.min(licDiff, insDiff);

    if (minDiff < 0) card.classList.add('border-red');
    else if (minDiff <= 15) card.classList.add('border-yellow');

    const licClass = expiryClass(licDiff);
    const insClass = expiryClass(insDiff);

    const carId = escapeHtml(data.carId || id);
    const assigneeName = escapeHtml(data.currentUserName || 'Unassigned');
    const assignmentText = data.currentUserName
        ? `Assigned to: ${assigneeName}`
        : 'Currently unassigned';

    let actionsHtml = '';
    if (!isUserView) {
        actionsHtml = `
            <div class="action-buttons" id="car-actions-${id}">
                <button type="button" class="action-btn action-btn-edit" data-action="edit">Edit</button>
                ${data.currentUserId
                    ? '<button type="button" class="action-btn action-btn-unassign" data-action="unassign">Unassign</button>'
                    : '<button type="button" class="action-btn action-btn-assign" data-action="assign">Assign</button>'}
                <button type="button" class="action-btn action-btn-print" data-action="print">Print</button>
                <button type="button" class="action-btn action-btn-history" data-action="history">History</button>
                <button type="button" class="action-btn action-btn-violations" data-action="violations">Violations</button>
            </div>
            <div id="assign-area-${id}" class="car-action-area"></div>
            <div id="edit-area-${id}" class="car-action-area"></div>
            <div id="history-area-${id}" class="car-action-area"></div>
            <div id="violations-area-${id}" class="car-action-area violations-inline-area"></div>
        `;
    } else {
        actionsHtml = `
            <div class="action-buttons">
                <button type="button" class="action-btn action-btn-unlink" id="req-unlink-${id}">Request Unlink</button>
                <button type="button" class="action-btn action-btn-history" id="my-history-${id}">My History</button>
                <button type="button" class="action-btn action-btn-violations" id="car-violations-${id}">Violations</button>
            </div>
            <div id="history-area-${id}" class="car-action-area"></div>
            <div id="violations-area-${id}" class="car-action-area violations-inline-area"></div>
        `;
    }

    card.innerHTML = `
        <div class="card-header car-card-header" id="header-${id}" role="button" tabindex="0" aria-expanded="false" aria-controls="body-${id}">
            <div class="car-summary-id">${carId}</div>
            <div class="car-summary-divider" aria-hidden="true"></div>
            <div class="car-assignment-status"><span>Assignment</span><strong>${assignmentText}</strong></div>
            <div class="plate-wrapper">
                <div class="plate-container" aria-label="${escapeAttribute(data.emirate)} plate ${escapeAttribute(data.plateNumber)} ${escapeAttribute(data.plateCode)}">
                    <span class="plate-emirate">${escapeHtml(data.emirate || 'UAE')}</span>
                    <span class="plate-number">${escapeHtml(data.plateNumber)}</span>
                    <span class="plate-code">${escapeHtml(data.plateCode)}</span>
                </div>
            </div>
        </div>
        <div class="card-body" id="body-${id}">
            <div class="detail-list">
                <div class="detail-item"><span class="detail-label">Emirate</span><span class="detail-value">${escapeHtml(data.emirate || 'N/A')}</span></div>
                <div class="detail-item"><span class="detail-label">Type</span><span class="detail-value">${escapeHtml(data.type || 'N/A')}</span></div>
                <div class="detail-item"><span class="detail-label">Owner Name</span><span class="detail-value">${escapeHtml(data.ownerName || 'N/A')}</span></div>
                <div class="detail-item"><span class="detail-label">VIN</span><span class="detail-value">${escapeHtml(data.vin || 'N/A')}</span></div>
                <div class="detail-item"><span class="detail-label">Manufacture Year</span><span class="detail-value">${escapeHtml(data.manufactureYear || 'N/A')}</span></div>
                <div class="detail-item"><span class="detail-label">License Expiry</span><span class="detail-value ${licClass}">${escapeHtml(formatDateOnly(data.licenseExpiry))} (${licDiff} days left)</span></div>
                <div class="detail-item"><span class="detail-label">Insurance Expiry</span><span class="detail-value ${insClass}">${escapeHtml(formatDateOnly(data.insuranceExpiry))} (${insDiff} days left)</span></div>
                <div class="detail-item"><span class="detail-label">Notes</span><span class="detail-value">${escapeHtml(data.notes || 'N/A')}</span></div>
            </div>
            <div class="car-card-actions">${actionsHtml}</div>
        </div>
    `;

    listContainer.appendChild(card);

    const headerEl = card.querySelector(`#header-${id}`);
    if (headerEl) {
        const toggleCard = () => {
            const willOpen = !card.classList.contains('open');
            card.classList.toggle('open', willOpen);
            headerEl.setAttribute('aria-expanded', String(willOpen));
        };
        headerEl.addEventListener('click', event => {
            if (!['SELECT', 'BUTTON', 'INPUT'].includes(event.target.tagName)) toggleCard();
        });
        headerEl.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleCard();
            }
        });
    }

    const actionsWrap = card.querySelector(`#car-actions-${id}`);
    if (actionsWrap) {
        actionsWrap.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleCarAction(id, btn.getAttribute('data-action'), data);
            });
        });
    }

    const reqUnlinkBtn = card.querySelector(`#req-unlink-${id}`);
    if (reqUnlinkBtn) {
        reqUnlinkBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            createUnlinkRequest(id, data);
        });
    }

    const myHistoryBtn = card.querySelector(`#my-history-${id}`);
    if (myHistoryBtn) {
        myHistoryBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renderMyCarHistory(id, data);
        });
    }

    const violationsBtn = card.querySelector(`#car-violations-${id}`);
    if (violationsBtn) {
        violationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            renderCarViolations(id, data);
        });
    }
}

async function handleCarAction(id, action, data) {
    if (!action || !isAdmin(currentUserData)) return;

    const assignArea = document.getElementById(`assign-area-${id}`);
    const editArea = document.getElementById(`edit-area-${id}`);
    const historyArea = document.getElementById(`history-area-${id}`);
    const violationsArea = document.getElementById(`violations-area-${id}`);

    if (assignArea) assignArea.style.display = 'none';
    if (editArea) editArea.style.display = 'none';
    if (historyArea) historyArea.style.display = 'none';
    if (violationsArea) violationsArea.style.display = 'none';

    if (action === 'edit') {
        renderEditCarForm(id, data);
    } else if (action === 'print') {
        handlePrintCard(data);
    } else if (action === 'history') {
        await renderCarHistory(id, data);
    } else if (action === 'violations') {
        await renderCarViolations(id, data);
    } else if (action === 'assign') {
        await renderAssignUserUI(id);
    } else if (action === 'unassign') {
        await handleUnassignUser(id, data);
    }
}

function renderEditCarForm(carId, data) {
    const editArea = document.getElementById(`edit-area-${carId}`);
    if (!editArea) return;

    editArea.style.display = 'block';
    editArea.innerHTML = `
        <h4>Edit Car</h4>
        <form id="edit-car-form-${carId}" class="edit-car-form">
            <div class="form-group">
                <label>Plate Number</label>
                <input type="text" id="edit-plate-num-${carId}" value="${escapeAttribute(data.plateNumber)}" required pattern="\\d+" maxlength="6">
            </div>
            <div class="form-group">
                <label>Plate Code</label>
                <input type="text" id="edit-plate-code-${carId}" value="${escapeAttribute(data.plateCode)}" required maxlength="3">
            </div>
            <div class="form-group">
                <label>Emirate</label>
                <select id="edit-emirate-${carId}" required>
                    <option value="Abu Dhabi" ${data.emirate === 'Abu Dhabi' ? 'selected' : ''}>Abu Dhabi</option>
                    <option value="Dubai" ${data.emirate === 'Dubai' ? 'selected' : ''}>Dubai</option>
                    <option value="Sharjah" ${data.emirate === 'Sharjah' ? 'selected' : ''}>Sharjah</option>
                    <option value="Ajman" ${data.emirate === 'Ajman' ? 'selected' : ''}>Ajman</option>
                    <option value="Fujairah" ${data.emirate === 'Fujairah' ? 'selected' : ''}>Fujairah</option>
                    <option value="Umm Al Quwain" ${data.emirate === 'Umm Al Quwain' ? 'selected' : ''}>Umm Al Quwain</option>
                    <option value="Ras Al Khaimah" ${data.emirate === 'Ras Al Khaimah' ? 'selected' : ''}>Ras Al Khaimah</option>
                    <option value="Other" ${data.emirate === 'Other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Type (Make)</label>
                <input type="text" id="edit-type-${carId}" value="${escapeAttribute(data.type)}" required maxlength="80">
            </div>
            <div class="form-group">
                <label>Owner Name</label>
                <input type="text" id="edit-owner-${carId}" value="${escapeAttribute(data.ownerName)}" required maxlength="80">
            </div>
            <div class="form-group">
                <label>VIN</label>
                <input type="text" id="edit-vin-${carId}" value="${escapeAttribute(data.vin)}" required maxlength="40">
            </div>
            <div class="form-group">
                <label>Manufacture Year</label>
                <input type="number" id="edit-year-${carId}" value="${escapeAttribute(data.manufactureYear || '')}" required min="1900" max="2100">
            </div>
            <div class="form-group">
                <label>License Expiry</label>
                <input type="date" id="edit-lic-${carId}" value="${toDateInputValue(data.licenseExpiry)}" required>
            </div>
            <div class="form-group">
                <label>Insurance Expiry</label>
                <input type="date" id="edit-ins-${carId}" value="${toDateInputValue(data.insuranceExpiry)}" required>
            </div>
            <div class="form-group full-width">
                <label>Notes</label>
                <input type="text" id="edit-notes-${carId}" value="${escapeAttribute(data.notes || '')}" maxlength="500">
            </div>
            <div class="form-group full-width" style="display:flex; gap:10px;">
                <button type="submit" class="btn btn-sm btn-success">Save Changes</button>
                <button type="button" class="btn btn-sm btn-secondary" id="cancel-edit-${carId}">Cancel</button>
            </div>
        </form>
    `;

    const editForm = document.getElementById(`edit-car-form-${carId}`);
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleSaveEditCar(carId, data);
        });
    }

    const cancelEditBtn = document.getElementById(`cancel-edit-${carId}`);
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            editArea.style.display = 'none';
            editArea.innerHTML = '';
        });
    }
}

async function handleSaveEditCar(carId, originalData) {
    if (!isAdmin(currentUserData)) return;

    const plateNum = sanitizePlainText(document.getElementById(`edit-plate-num-${carId}`).value, 6);
    const plateCode = sanitizePlainText(document.getElementById(`edit-plate-code-${carId}`).value, 3).toUpperCase();
    const emirate = document.getElementById(`edit-emirate-${carId}`).value;
    const type = sanitizePlainText(document.getElementById(`edit-type-${carId}`).value, 80);
    const owner = sanitizePlainText(document.getElementById(`edit-owner-${carId}`).value, 80);
    const vin = sanitizePlainText(document.getElementById(`edit-vin-${carId}`).value, 40).toUpperCase();
    const year = parseInt(document.getElementById(`edit-year-${carId}`).value);
    const licExp = document.getElementById(`edit-lic-${carId}`).value;
    const insExp = document.getElementById(`edit-ins-${carId}`).value;
    const notes = sanitizePlainText(document.getElementById(`edit-notes-${carId}`).value, 500);

    if (isNaN(year) || year < 1900 || year > 2026) {
        showMessage('Error: Please enter a valid manufacture year (1900-2026).', 'error', 'dashboard');
        return;
    }

    const plateIdentifier = `${plateNum}-${plateCode.toLowerCase()}-${emirate.toLowerCase()}`;

    try {
        if (plateIdentifier !== originalData.plateIdentifier) {
            const plateQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier));
            const plateSnap = await getDocs(plateQ);
            if (!plateSnap.empty) throw new Error('This plate combination already exists.');
        }

        if (vin !== originalData.vin) {
            const vinQ = query(collection(db, 'cars'), where('vin', '==', vin));
            const vinSnap = await getDocs(vinQ);
            if (!vinSnap.empty) throw new Error('This VIN already exists.');
        }

        await updateDoc(doc(db, 'cars', carId), {
            plateNumber: plateNum,
            plateCode,
            emirate,
            plateIdentifier,
            type,
            ownerName: owner,
            vin,
            manufactureYear: year,
            licenseExpiry: new Date(licExp),
            insuranceExpiry: new Date(insExp),
            notes,
            updatedAt: serverTimestamp()
        });

        const label = formatCarLabel({ carId, plateNumber: plateNum, plateCode, emirate });
        await logAction(currentUserData, 'EDIT_CAR', {
            targetId: carId,
            targetName: label,
            text: `Edited car ${label}`
        });

        showMessage('Car details updated successfully.', 'success', 'dashboard');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (error) {
        console.error('Update car failed:', error);
        showMessage('Could not update the car. Verify the entered details and try again.', 'error', 'dashboard');
    }
}

function handlePrintCard(data) {
    try {
        const label = formatCarLabel(data);
        const licStr = formatDateOnly(data.licenseExpiry);
        const insStr = formatDateOnly(data.insuranceExpiry);
        const safe = (v) => String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Car Card - ${safe(data.carId)}</title>
    <style>
        @page { margin: 12mm; }
        body { font-family: Arial, sans-serif; padding: 16px; text-align: center; color: #222; }
        .print-header { border-bottom: 2px solid #1976d2; margin-bottom: 16px; padding-bottom: 10px; }
        .print-header h2 { margin: 0; color: #1565c0; font-size: 18px; }
        h3 { margin: 12px 0; font-size: 15px; word-break: break-word; }
        .plate-container { display: inline-grid; grid-template-columns: 76px 1fr auto; align-items: center; gap: 14px; min-width: 300px; border: 2px solid #d9262e; border-radius: 8px; padding: 10px 18px; margin: 16px 0; }
        .plate-emirate { color: #1c5c98; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-align: center; text-transform: uppercase; white-space: nowrap; }
        .plate-number { font-family: 'Courier New', monospace; font-size: 28px; font-weight: bold; letter-spacing: 3px; font-variant-numeric: tabular-nums; text-align: center; display: inline-block; white-space: nowrap; }
        .plate-code { font-family: 'Courier New', monospace; font-size: 22px; font-weight: bold; color: #fff; background: #d9262e; padding: 2px 8px; border-radius: 4px; letter-spacing: 2px; white-space: nowrap; }
        .details { text-align: left; max-width: 420px; margin: 0 auto; }
        .detail-row { margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        .detail-label { font-weight: bold; color: #1976d2; font-size: 12px; display: inline-block; min-width: 140px; }
        .detail-value { font-size: 15px; color: #333; }
    </style>
</head>
<body>
    <div class="print-header">
        <h2>Car Management System</h2>
    </div>
    <h3>${safe(label)}</h3>
    <div class="plate-container">
        <span class="plate-emirate">${safe(data.emirate || 'UAE')}</span>
        <span class="plate-number">${safe(data.plateNumber)}</span>
        <span class="plate-code">${safe(data.plateCode)}</span>
    </div>
    <div class="details">
        <div class="detail-row"><span class="detail-label">Owner Name:</span> <span class="detail-value">${safe(data.ownerName)}</span></div>
        <div class="detail-row"><span class="detail-label">Type:</span> <span class="detail-value">${safe(data.type)}</span></div>
        <div class="detail-row"><span class="detail-label">VIN:</span> <span class="detail-value">${safe(data.vin)}</span></div>
        <div class="detail-row"><span class="detail-label">Manufacture Year:</span> <span class="detail-value">${safe(data.manufactureYear || 'N/A')}</span></div>
        <div class="detail-row"><span class="detail-label">License Expiry:</span> <span class="detail-value">${safe(licStr)}</span></div>
        <div class="detail-row"><span class="detail-label">Insurance Expiry:</span> <span class="detail-value">${safe(insStr)}</span></div>
        <div class="detail-row"><span class="detail-label">Current Assignee:</span> <span class="detail-value">${safe(data.currentUserName || 'Unassigned')}</span></div>
        <div class="detail-row"><span class="detail-label">Notes:</span> <span class="detail-value">${safe(data.notes || 'N/A')}</span></div>
    </div>
</body>
</html>`;

        // FIXED PRINT - works in all browsers
        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) {
            showMessage('Please allow popups to print.', 'warning', 'dashboard');
            return;
        }
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        // Wait for content to render
        const doPrint = () => {
            try {
                printWin.print();
            } catch (e) {
                showMessage('Error: Unable to open print dialog.', 'error', 'dashboard');
            }
            // Don't auto-close immediately, let user close after print
            setTimeout(() => {
                try { if (!printWin.closed) printWin.close(); } catch(e){}
            }, 1000);
        };
        if (printWin.document.readyState === 'complete') {
            setTimeout(doPrint, 300);
        } else {
            printWin.onload = () => setTimeout(doPrint, 300);
        }
    } catch (error) {
        showMessage(`Print error: ${error.message}`, 'error', 'dashboard');
    }
}

async function renderCarHistory(carId, carData) {
    const historyArea = document.getElementById(`history-area-${carId}`);
    if (!historyArea) return;

    historyArea.style.display = 'block';
    historyArea.innerHTML = '<p class="loading-text" style="font-size: 0.85rem;">Loading history...</p>';

    const carLabel = formatCarLabel(carData);
    let html = `<div class="history-list"><h4>History for ${escapeHtml(carLabel)}</h4>`;

    try {
        const logsQuery = query(collection(db, 'logs'), where('targetId', '==', carId), limit(20));
        const logsSnap = await getDocs(logsQuery);

        if (logsSnap.empty) {
            html += '<p class="history-item">No activity recorded yet.</p>';
        } else {
            const logs = [];
            logsSnap.forEach(doc => logs.push(doc.data()));
            logs.sort((a, b) => {
                const tA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
                const tB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
                return tB - tA;
            });

            logs.slice(0, 8).forEach(log => {
                const date = formatDateTime(log.timestamp);
                html += `
                    <div class="history-item">
                        <span class="action-type">${escapeHtml(log.actionType)}</span> by ${escapeHtml(log.actorName)}<br>
                        ${escapeHtml(log.details || '')}<br>
                        <span class="timestamp-meta">${escapeHtml(date)}</span>
                    </div>
                `;
            });
        }

        const assignQuery = query(
            collection(db, 'cars', carId, 'assignments'),
            orderBy('startTime', 'desc'),
            limit(5)
        );
        const assignSnap = await getDocs(assignQuery);

        if (!assignSnap.empty) {
            html += '<h4 style="margin-top: 15px;">Assignment Periods</h4>';
            assignSnap.forEach(doc => {
                const a = doc.data();
                const period = formatPeriod(a.startTime, a.endTime);
                html += `
                    <div class="history-item">
                        <strong>${escapeHtml(a.userName)}</strong><br>
                        ${escapeHtml(period)}
                    </div>
                `;
            });
        }

        html += '</div>';
        historyArea.innerHTML = html;
    } catch (error) {
        console.error('Load car history failed:', error);
        historyArea.innerHTML = '<p class="error" style="font-size:0.85rem;">Unable to load history.</p>';
    }
}

async function renderMyCarHistory(carId, carData) {
    const historyArea = document.getElementById(`history-area-${carId}`);
    if (!historyArea) return;

    historyArea.style.display = 'block';
    historyArea.innerHTML = '<p class="loading-text" style="font-size: 0.85rem;">Loading your history...</p>';

    const carLabel = formatCarLabel(carData);
    let html = `<div class="history-list"><h4>My History for ${escapeHtml(carLabel)}</h4>`;

    try {
        // 1. فترات التعيين الخاصة بالمستخدم فقط
        const assignQuery = query(
            collection(db, 'cars', carId, 'assignments'),
            where('userId', '==', currentUserData.uid),
            limit(20)
        );
        const assignSnap = await getDocs(assignQuery);

        if (assignSnap.empty) {
            html += '<p class="history-item">No assignment periods found for you.</p>';
        } else {
            const assignments = [];
            assignSnap.forEach(doc => assignments.push(doc.data()));

            assignments.sort((a, b) => {
                const tA = a.startTime ? (a.startTime.toDate ? a.startTime.toDate().getTime() : new Date(a.startTime).getTime()) : 0;
                const tB = b.startTime ? (b.startTime.toDate ? b.startTime.toDate().getTime() : new Date(b.startTime).getTime()) : 0;
                return tB - tA;
            });

            html += '<h4 style="margin-top: 10px;">Your Assignment Periods</h4>';
            assignments.slice(0, 10).forEach(a => {
                const period = formatPeriod(a.startTime, a.endTime);
                html += `
                    <div class="history-item">
                        <strong>You</strong><br>
                        ${period}
                    </div>
                `;
            });
        }

        // 2. السجلات الخاصة بالمستخدم فقط (استعلامان منفصلان لتجنب مشكلة القواعد)
        const actorLogsQuery = query(
            collection(db, 'logs'),
            where('actorId', '==', currentUserData.uid),
            where('targetId', '==', carId),
            limit(15)
        );
        const assigneeLogsQuery = query(
            collection(db, 'logs'),
            where('assigneeId', '==', currentUserData.uid),
            where('targetId', '==', carId),
            limit(15)
        );

        const [actorSnap, assigneeSnap] = await Promise.all([
            getDocs(actorLogsQuery),
            getDocs(assigneeLogsQuery)
        ]);

        const myLogs = [];
        actorSnap.forEach(doc => myLogs.push(doc.data()));
        assigneeSnap.forEach(doc => myLogs.push(doc.data()));

        // إزالة التكرار
        const uniqueLogs = [];
        const seen = new Set();
        myLogs.forEach(log => {
            const key = (log.timestamp?.seconds || 0) + log.actionType + (log.details || '');
            if (!seen.has(key)) {
                seen.add(key);
                uniqueLogs.push(log);
            }
        });

        uniqueLogs.sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const tB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return tB - tA;
        });

        if (uniqueLogs.length > 0) {
            html += '<h4 style="margin-top: 15px;">Related Activity</h4>';
            uniqueLogs.slice(0, 8).forEach(log => {
                const date = formatDateTime(log.timestamp);
                html += `
                    <div class="history-item">
                        <span class="action-type">${escapeHtml(log.actionType)}</span><br>
                        ${escapeHtml(log.details || '')}<br>
                        <span class="timestamp-meta">${escapeHtml(date)}</span>
                    </div>
                `;
            });
        }

        html += '</div>';
        historyArea.innerHTML = html;

    } catch (error) {
        console.error('Load personal car history failed:', error);
        historyArea.innerHTML = '<p class="error" style="font-size:0.85rem;">Unable to load your history.</p>';
    }
    
    }
    
    
async function renderAssignUserUI(carId) {
    const assignArea = document.getElementById(`assign-area-${carId}`);
    if (!assignArea) return;

    assignArea.style.display = 'block';
    assignArea.innerHTML = '<p class="loading-text" style="font-size: 0.85rem;">Loading active users...</p>';

    try {
        const q = query(collection(db, 'users'), where('status', '==', 'active'));
        const snapshot = await getDocs(q);

        let options = '<option value="">Select Active User</option>';
        snapshot.forEach(d => {
            const u = d.data();
            options += `<option value="${escapeAttribute(d.id)}">${escapeHtml(u.username)} (${escapeHtml(u.role)})</option>`;
        });

        assignArea.innerHTML = `
            <select class="action-select" id="select-user-${carId}">${options}</select>
            <button class="btn btn-sm btn-success" id="confirm-assign-${carId}" style="margin-top: 10px;">Confirm Assign</button>
        `;

        const confirmAssignBtn = document.getElementById(`confirm-assign-${carId}`);
        if (!confirmAssignBtn) return;

        confirmAssignBtn.addEventListener('click', async () => {
            const selectUser = document.getElementById(`select-user-${carId}`);
            const userId = selectUser ? selectUser.value : '';
            if (!userId) {
                showMessage('Please select a user first.', 'warning', 'dashboard');
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (!userDoc.exists()) throw new Error('User not found.');
                const userName = userDoc.data().username;

                const carRef = doc(db, 'cars', carId);
                const carDoc = await getDoc(carRef);
                if (!carDoc.exists()) throw new Error('Car not found.');
                const carData = carDoc.data();
                const label = formatCarLabel(carData);
                const assignmentRef = doc(collection(db, 'cars', carId, 'assignments'));
                const batch = writeBatch(db);

                batch.update(carRef, {
                    currentUserId: userId,
                    currentUserName: userName,
                    updatedAt: serverTimestamp()
                });
                batch.set(assignmentRef, {
                    userId,
                    userName,
                    startTime: serverTimestamp(),
                    endTime: null
                });
                await batch.commit();

                await logAction(currentUserData, 'CAR_ASSIGN', {
                    targetId: carId,
                    targetName: label,
                    assigneeId: userId,
                    text: `Assigned ${label} to ${userName}`
                });

                showMessage(`User has been assigned to the car successfully.`, 'success', 'dashboard');
                lastVisibleCar = null;
                fetchCars(false);
            } catch (err) {
                console.error('Assign user failed:', err);
                showMessage('Could not assign the selected user. Please try again.', 'error', 'dashboard');
            }
        });
    } catch (err) {
        console.error('Load active users failed:', err);
        assignArea.innerHTML = '<p class="error" style="font-size:0.85rem;">Unable to load active users.</p>';
    }
}

async function handleUnassignUser(carId, data) {
    if (!data.currentUserId || !isAdmin(currentUserData)) return;

    if (!confirm(`Unassign “${data.currentUserName}” from this car?\n\nThe assignment period will be closed and the car will become available.`)) {
        return;
    }

    try {
        const label = formatCarLabel(data);

        const q = query(
            collection(db, 'cars', carId, 'assignments'),
            where('userId', '==', data.currentUserId),
            where('endTime', '==', null),
            limit(1)
        );
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        batch.update(doc(db, 'cars', carId), {
            currentUserId: null,
            currentUserName: null,
            updatedAt: serverTimestamp()
        });
        if (!snap.empty) {
            batch.update(doc(db, 'cars', carId, 'assignments', snap.docs[0].id), {
                endTime: serverTimestamp()
            });
        }
        await batch.commit();

        await logAction(currentUserData, 'CAR_UNASSIGN', {
            targetId: carId,
            targetName: label,
            assigneeId: data.currentUserId,
            text: `Unassigned ${label} from ${data.currentUserName}`
        });

        showMessage(`“${data.currentUserName}” has been unassigned from the car.`, 'success', 'dashboard');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (err) {
        console.error('Unassign user failed:', err);
        showMessage('Could not unassign this car. Please try again.', 'error', 'dashboard');
    }
}