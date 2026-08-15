/**
 * Cars Module - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { db } from "./firebase.js";
import {
    collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
    query, where, limit, startAfter, orderBy, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import { createLinkRequest, createUnlinkRequest } from "./requests.js";
import {
    showMessage, handleFirebaseError, formatDateTime, formatDateOnly,
    formatPeriod, formatCarLabel, isAdmin, isActiveUser, renderAccessDenied,
    daysUntil, expiryClass, toDateInputValue
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

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
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
    const licenseExpEl = document.getElementById('car-license-exp');
    const insuranceExpEl = document.getElementById('car-insurance-exp');
    const notesEl = document.getElementById('car-notes');

    if (!plateNumEl || !plateCodeEl || !emirateSelect || !typeEl || !ownerEl || !vinEl || !licenseExpEl || !insuranceExpEl) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Car';
        }
        showMessage('Error: Form elements not found.', 'error', 'dashboard');
        return;
    }

    const plateNum = plateNumEl.value.trim();
    const plateCode = plateCodeEl.value.trim().toUpperCase();
    const emirate = emirateSelect.value;
    const type = typeEl.value.trim();
    const owner = ownerEl.value.trim();
    const vin = vinEl.value.trim().toUpperCase();
    const licenseExp = licenseExpEl.value;
    const insuranceExp = insuranceExpEl.value;
    const notes = notesEl ? notesEl.value.trim() : '';

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
            licenseExpiry: new Date(licenseExp),
            insuranceExpiry: new Date(insuranceExp),
            notes,
            currentUserId: null,
            currentUserName: null,
            status: 'active',
            createdAt: serverTimestamp()
        });

        await logAction(currentUserData, 'CREATE_CAR', {
            targetId: carId,
            targetName: formatCarLabel({ carId, plateNumber: plateNum, plateCode, emirate }),
            text: `Created car ${formatCarLabel({ carId, plateNumber: plateNum, plateCode, emirate })}`
        });

        showMessage('Success: Car added successfully.', 'success', 'dashboard');
        const addForm = document.getElementById('add-car-form');
        if (addForm) addForm.reset();
        const addWrapper = document.getElementById('add-car-form-wrapper');
        if (addWrapper) addWrapper.classList.add('hidden-form');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', 'dashboard');
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

        if (filter && filter !== 'all') sessionStorage.removeItem('carsFilter');
    } catch (error) {
        if (listContainer) {
            listContainer.innerHTML = `<p class="error">Error loading cars: ${error.message}</p>`;
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
        listContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
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

    const emirateColors = {
        'Abu Dhabi': '#0070c0',
        'Dubai': '#b91d1d',
        'Sharjah': '#000000',
        'Ajman': '#ed1c24',
        'Fujairah': '#8a2be2',
        'Umm Al Quwain': '#006400',
        'Ras Al Khaimah': '#ff8c00',
        'Other': '#666666'
    };
    const topBarColor = emirateColors[data.emirate] || '#666666';

    let actionsHtml = '';
    if (!isUserView) {
        actionsHtml = `
            <div class="action-buttons" id="car-actions-${id}">
                <button type="button" class="action-btn action-btn-edit" data-action="edit">✎ Edit</button>
                ${data.currentUserId
                    ? '<button type="button" class="action-btn action-btn-unassign" data-action="unassign">👤 Unassign</button>'
                    : '<button type="button" class="action-btn action-btn-assign" data-action="assign">👤 Assign</button>'}
                <button type="button" class="action-btn action-btn-print" data-action="print">🖨 Print</button>
                <button type="button" class="action-btn action-btn-history" data-action="history">📋 History</button>
            </div>
            <div id="assign-area-${id}" style="margin-top: 10px; display:none;"></div>
            <div id="edit-area-${id}" style="margin-top: 10px; display:none;"></div>
            <div id="history-area-${id}" style="margin-top: 10px; display:none;"></div>
        `;
    } else {
        actionsHtml = `
            <div class="action-buttons">
                <button type="button" class="action-btn action-btn-unlink" id="req-unlink-${id}">✎ Request Unlink</button>
                <button type="button" class="action-btn action-btn-history" id="my-history-${id}">📋 My History</button>
            </div>
            <div id="history-area-${id}" style="margin-top: 10px; display:none;"></div>
        `;
    }

    card.innerHTML = `
        <div class="card-header" id="header-${id}">
            <div class="card-header-top">
                <div class="card-title">
                    <div class="plate-wrapper">
                        <div class="plate-meta-top">
                            <span class="plate-id">${data.carId}</span>
                            <span class="meta-separator"></span>
                            <span class="plate-owner">Assignee: ${data.currentUserName || 'Unassigned'}</span>
                        </div>
                        <div class="plate-container">
                            <div style="display:flex; flex-direction:column; align-items:center;">
                                <div class="plate-top-bar" style="background:${topBarColor};"></div>
                                <span class="plate-emirate">${data.emirate}</span>
                            </div>
                            <span class="plate-number">${data.plateNumber}</span>
                            <span class="plate-code">${data.plateCode}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-body" id="body-${id}">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">${data.type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Owner Name</span>
                    <span class="detail-value">${data.ownerName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">VIN</span>
                    <span class="detail-value">${data.vin}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">License Expiry</span>
                    <span class="detail-value ${licClass}">${formatDateOnly(data.licenseExpiry)} (${licDiff} days left)</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Insurance Expiry</span>
                    <span class="detail-value ${insClass}">${formatDateOnly(data.insuranceExpiry)} (${insDiff} days left)</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Notes</span>
                    <span class="detail-value">${data.notes || 'N/A'}</span>
                </div>
            </div>
            <div style="margin-top: 15px;">${actionsHtml}</div>
        </div>
    `;

    listContainer.appendChild(card);

    const headerEl = card.querySelector(`#header-${id}`);
    if (headerEl) {
        headerEl.addEventListener('click', (e) => {
            if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                card.classList.toggle('open');
            }
        });
    }

    const actionsWrap = card.querySelector(`#car-actions-${id}`);
    if (actionsWrap) {
        actionsWrap.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleCarAction(id, btn.getAttribute('data-action'), data, topBarColor);
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
}

async function handleCarAction(id, action, data, topBarColor) {
    if (!action || !isAdmin(currentUserData)) return;

    const assignArea = document.getElementById(`assign-area-${id}`);
    const editArea = document.getElementById(`edit-area-${id}`);
    const historyArea = document.getElementById(`history-area-${id}`);

    if (assignArea) assignArea.style.display = 'none';
    if (editArea) editArea.style.display = 'none';
    if (historyArea) historyArea.style.display = 'none';

    if (action === 'edit') {
        renderEditCarForm(id, data);
    } else if (action === 'print') {
        handlePrintCard(data, topBarColor);
    } else if (action === 'history') {
        await renderCarHistory(id, data);
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
                <input type="text" id="edit-plate-num-${carId}" value="${data.plateNumber}" required pattern="\\d+" maxlength="6">
            </div>
            <div class="form-group">
                <label>Plate Code</label>
                <input type="text" id="edit-plate-code-${carId}" value="${data.plateCode}" required maxlength="3">
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
                <input type="text" id="edit-type-${carId}" value="${data.type}" required>
            </div>
            <div class="form-group">
                <label>Owner Name</label>
                <input type="text" id="edit-owner-${carId}" value="${data.ownerName}" required>
            </div>
            <div class="form-group">
                <label>VIN</label>
                <input type="text" id="edit-vin-${carId}" value="${data.vin}" required>
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
                <input type="text" id="edit-notes-${carId}" value="${data.notes || ''}">
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

    const plateNum = document.getElementById(`edit-plate-num-${carId}`).value.trim();
    const plateCode = document.getElementById(`edit-plate-code-${carId}`).value.trim().toUpperCase();
    const emirate = document.getElementById(`edit-emirate-${carId}`).value;
    const type = document.getElementById(`edit-type-${carId}`).value.trim();
    const owner = document.getElementById(`edit-owner-${carId}`).value.trim();
    const vin = document.getElementById(`edit-vin-${carId}`).value.trim().toUpperCase();
    const licExp = document.getElementById(`edit-lic-${carId}`).value;
    const insExp = document.getElementById(`edit-ins-${carId}`).value;
    const notes = document.getElementById(`edit-notes-${carId}`).value.trim();

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
            licenseExpiry: new Date(licExp),
            insuranceExpiry: new Date(insExp),
            notes
        });

        const label = formatCarLabel({ carId, plateNumber: plateNum, plateCode, emirate });
        await logAction(currentUserData, 'EDIT_CAR', {
            targetId: carId,
            targetName: label,
            text: `Edited car ${label}`
        });

        showMessage('Success: Car updated successfully.', 'success', 'dashboard');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', 'dashboard');
    }
}

function handlePrintCard(data, topBarColor) {
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
        .plate-container { display: inline-flex; align-items: center; gap: 14px; border: 2px solid #000; border-radius: 8px; padding: 10px 18px; margin: 16px 0; }
        .plate-top-bar { width: 100%; height: 5px; margin-bottom: 5px; border-radius: 2px; background: ${topBarColor || '#666'}; }
        .plate-emirate { font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .plate-number { font-family: 'Courier New', monospace; font-size: 28px; font-weight: bold; letter-spacing: 3px; font-variant-numeric: tabular-nums; width: 7ch; text-align: center; display: inline-block; }
        .plate-code { font-family: 'Courier New', monospace; font-size: 22px; font-weight: bold; color: #fff; background: #000; padding: 2px 8px; border-radius: 4px; letter-spacing: 2px; }
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
        <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="plate-top-bar"></div>
            <span class="plate-emirate">${safe(data.emirate)}</span>
        </div>
        <span class="plate-number">${safe(data.plateNumber)}</span>
        <span class="plate-code">${safe(data.plateCode)}</span>
    </div>
    <div class="details">
        <div class="detail-row"><span class="detail-label">Owner Name:</span> <span class="detail-value">${safe(data.ownerName)}</span></div>
        <div class="detail-row"><span class="detail-label">Type:</span> <span class="detail-value">${safe(data.type)}</span></div>
        <div class="detail-row"><span class="detail-label">VIN:</span> <span class="detail-value">${safe(data.vin)}</span></div>
        <div class="detail-row"><span class="detail-label">License Expiry:</span> <span class="detail-value">${safe(licStr)}</span></div>
        <div class="detail-row"><span class="detail-label">Insurance Expiry:</span> <span class="detail-value">${safe(insStr)}</span></div>
        <div class="detail-row"><span class="detail-label">Current Assignee:</span> <span class="detail-value">${safe(data.currentUserName || 'Unassigned')}</span></div>
        <div class="detail-row"><span class="detail-label">Notes:</span> <span class="detail-value">${safe(data.notes || 'N/A')}</span></div>
    </div>
</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(iframe);

        const idoc = iframe.contentWindow.document;
        idoc.open();
        idoc.write(html);
        idoc.close();

        const triggerPrint = () => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (err) {
                showMessage('Error: Unable to open print dialog.', 'error', 'dashboard');
            }
            setTimeout(() => {
                if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            }, 1500);
        };

        if (iframe.contentWindow.document.readyState === 'complete') {
            setTimeout(triggerPrint, 200);
        } else {
            iframe.onload = () => setTimeout(triggerPrint, 200);
            setTimeout(triggerPrint, 500);
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
    let html = `<div class="history-list"><h4>History for ${carLabel}</h4>`;

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
                        <span class="action-type">${log.actionType}</span> by ${log.actorName}<br>
                        ${log.details || ''}<br>
                        <span class="timestamp-meta">${date}</span>
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
                        <strong>${a.userName}</strong><br>
                        ${period}
                    </div>
                `;
            });
        }

        html += '</div>';
        historyArea.innerHTML = html;
    } catch (error) {
        historyArea.innerHTML = `<p class="error" style="font-size:0.85rem;">Error loading history: ${error.message}</p>`;
    }
}

async function renderMyCarHistory(carId, carData) {
    const historyArea = document.getElementById(`history-area-${carId}`);
    if (!historyArea) return;

    historyArea.style.display = 'block';
    historyArea.innerHTML = '<p class="loading-text" style="font-size: 0.85rem;">Loading your history...</p>';

    const carLabel = formatCarLabel(carData);
    let html = `<div class="history-list"><h4>My History for ${carLabel}</h4>`;

    try {
        // استعلام بسيط بدون orderBy (لا يحتاج Composite Index)
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

            // ترتيب على العميل
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

        // جلب السجلات الخاصة بالمستخدم فقط
        const logsQuery = query(
            collection(db, 'logs'),
            where('targetId', '==', carId),
            limit(30)
        );
        const logsSnap = await getDocs(logsQuery);

        const myLogs = [];
        logsSnap.forEach(doc => {
            const log = doc.data();
            if (log.actorId === currentUserData.uid || log.assigneeId === currentUserData.uid) {
                myLogs.push(log);
            }
        });

        myLogs.sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const tB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return tB - tA;
        });

        if (myLogs.length > 0) {
            html += '<h4 style="margin-top: 15px;">Related Activity</h4>';
            myLogs.slice(0, 8).forEach(log => {
                const date = formatDateTime(log.timestamp);
                html += `
                    <div class="history-item">
                        <span class="action-type">${log.actionType}</span><br>
                        ${log.details || ''}<br>
                        <span class="timestamp-meta">${date}</span>
                    </div>
                `;
            });
        }

        html += '</div>';
        historyArea.innerHTML = html;
    } catch (error) {
        historyArea.innerHTML = `<p class="error" style="font-size:0.85rem;">Error loading history: ${error.message}</p>`;
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
            options += `<option value="${d.id}">${u.username} (${u.role})</option>`;
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

                const carDoc = await getDoc(doc(db, 'cars', carId));
                const carData = carDoc.data();
                const label = formatCarLabel(carData);

                await updateDoc(doc(db, 'cars', carId), {
                    currentUserId: userId,
                    currentUserName: userName
                });

                await addDoc(collection(db, 'cars', carId, 'assignments'), {
                    userId,
                    userName,
                    startTime: serverTimestamp(),
                    endTime: null
                });

                await logAction(currentUserData, 'CAR_ASSIGN', {
                    targetId: carId,
                    targetName: label,
                    assigneeId: userId,
                    text: `Assigned ${label} to ${userName}`
                });

                showMessage('User assigned successfully.', 'success', 'dashboard');
                lastVisibleCar = null;
                fetchCars(false);
            } catch (err) {
                showMessage(`Error: ${err.message}`, 'error', 'dashboard');
            }
        });
    } catch (err) {
        assignArea.innerHTML = `<p class="error" style="font-size:0.85rem;">Error: ${err.message}</p>`;
    }
}

async function handleUnassignUser(carId, data) {
    if (!data.currentUserId || !isAdmin(currentUserData)) return;

    if (!confirm(`Are you sure you want to unassign "${data.currentUserName}" from this car?`)) {
        return;
    }

    try {
        const label = formatCarLabel(data);

        await updateDoc(doc(db, 'cars', carId), {
            currentUserId: null,
            currentUserName: null
        });

        const q = query(
            collection(db, 'cars', carId, 'assignments'),
            where('userId', '==', data.currentUserId),
            where('endTime', '==', null),
            limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            await updateDoc(doc(db, 'cars', carId, 'assignments', snap.docs[0].id), {
                endTime: serverTimestamp()
            });
        }

        await logAction(currentUserData, 'CAR_UNASSIGN', {
            targetId: carId,
            targetName: label,
            assigneeId: data.currentUserId,
            text: `Unassigned ${label} from ${data.currentUserName}`
        });

        showMessage('User unassigned successfully.', 'success', 'dashboard');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (err) {
        showMessage(`Error: ${err.message}`, 'error', 'dashboard');
    }
}