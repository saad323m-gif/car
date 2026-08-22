/**
 * Cars Module - Car Management System
 * English only | Latin digits only | Production-ready
 * Updated: Validators, loading states, confirm dialogs, ARIA, keyboard nav
 */

import { db } from "./firebase.js";
import {
    collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
    query, where, limit, startAfter, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import { createLinkRequest, createUnlinkRequest } from "./requests.js";
import {
    showMessage, handleFirebaseError, formatDateTime, formatDateOnly,
    formatPeriod, formatCarLabel, isAdmin, isActiveUser, renderAccessDenied,
    daysUntil, expiryClass, toDateInputValue, validators, validateField, sanitizeInput, containsNonEnglishDigits,
    renderConfirmDialog, setButtonLoading, resetButtonLoading, escapeHtml,
    generateCarId
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
        // داخل renderCarsView، استبدال قسم أزرار التصفية بـ:
container.innerHTML = `
    <h2>Cars Management</h2>
    <div class="divider"></div>

    <div class="cars-filters" id="cars-filters" role="group" aria-label="Car filters">
        <button class="filter-btn active" data-filter="all" aria-pressed="true">All</button>
        <button class="filter-btn" data-filter="expired" aria-pressed="false">Expired</button>
        <button class="filter-btn" data-filter="warning" aria-pressed="false">Expiring Soon</button>
        <button class="filter-btn" data-filter="assigned" aria-pressed="false">Assigned</button>
        <button class="filter-btn" data-filter="unassigned" aria-pressed="false">Unassigned</button>
    </div>

    <!-- باقي الكود كما هو -->
`;

            <button class="btn-add-toggle" id="toggle-add-car" aria-expanded="false" aria-controls="add-car-form-wrapper">+ Add New Car</button>
            <div id="add-car-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
                <form id="add-car-form">
                    <div class="form-group">
                        <label for="car-plate-num">Plate Number (Digits)</label>
                        <input type="text" id="car-plate-num" required pattern="\d+" maxlength="6" placeholder="e.g. 12345" inputmode="numeric">
                    </div>
                    <div class="form-group">
                        <label for="car-plate-code">Plate Code</label>
                        <input type="text" id="car-plate-code" required maxlength="3" placeholder="e.g. A">
                    </div>
                    <div class="form-group">
                        <label for="car-emirate">Emirate</label>
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
                        <label for="car-type">Type (Make)</label>
                        <input type="text" id="car-type" required placeholder="e.g. Toyota Camry">
                    </div>
                    <div class="form-group">
                        <label for="car-owner">Owner Name</label>
                        <input type="text" id="car-owner" required>
                    </div>
                    <div class="form-group">
                        <label for="car-vin">VIN</label>
                        <input type="text" id="car-vin" required placeholder="Vehicle Identification Number">
                    </div>
                    <div class="form-group">
                        <label for="car-year">Manufacture Year</label>
                        <input type="number" id="car-year" required min="1900" max="2026" placeholder="e.g. 2020">
                    </div>
                    <div class="form-group">
                        <label for="car-license-exp">License Expiry</label>
                        <input type="date" id="car-license-exp" required>
                    </div>
                    <div class="form-group">
                        <label for="car-insurance-exp">Insurance Expiry</label>
                        <input type="date" id="car-insurance-exp" required>
                    </div>
                    <div class="form-group">
                        <label for="car-notes">Notes</label>
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
                if (wrapper) {
                    wrapper.classList.toggle('hidden-form');
                    const expanded = !wrapper.classList.contains('hidden-form');
                    toggleAddCar.setAttribute('aria-expanded', expanded);
                }
            });
        }
        if (addCarForm) {
            addCarForm.addEventListener('submit', handleAddCar);
        }

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
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
            <button class="btn-add-toggle" id="toggle-request-car" aria-expanded="false" aria-controls="request-car-form-wrapper">+ Request to Use a Car</button>
            <div id="request-car-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
                <form id="request-car-form">
                    <div class="form-group">
                        <label for="req-plate-num">Plate Number</label>
                        <input type="text" id="req-plate-num" required pattern="\d+" maxlength="6" inputmode="numeric">
                    </div>
                    <div class="form-group">
                        <label for="req-plate-code">Plate Code</label>
                        <input type="text" id="req-plate-code" required maxlength="3">
                    </div>
                    <div class="form-group">
                        <label for="req-emirate">Emirate</label>
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
                if (wrapper) {
                    wrapper.classList.toggle('hidden-form');
                    const expanded = !wrapper.classList.contains('hidden-form');
                    toggleRequestCar.setAttribute('aria-expanded', expanded);
                }
            });
        }
        if (requestCarForm) {
            requestCarForm.addEventListener('submit', createLinkRequest);
        }
        fetchUserCars();
    }
}

async function handleAddCar(e) {
    e.preventDefault();
    if (!isAdmin(currentUserData)) return;

    setButtonLoading('btn-submit-car', 'Adding...');

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
        resetButtonLoading('btn-submit-car');
        showMessage('Error: Form elements not found.', 'error', 'dashboard');
        return;
    }

    const plateNum = sanitizeInput('car-plate-num');
    const plateCode = sanitizeInput('car-plate-code', { uppercase: true });
    const emirate = emirateSelect.value;
    const type = typeEl.value.trim();
    const owner = ownerEl.value.trim();
    const vin = vinEl.value.trim().toUpperCase();
    const manufactureYear = parseInt(yearEl.value);
    const licenseExp = licenseExpEl.value;
    const insuranceExp = insuranceExpEl.value;
    const notes = notesEl ? notesEl.value.trim() : '';

    if (containsNonEnglishDigits(plateNum)) {
        showMessage('Error: Only English digits (0-9) are allowed. Arabic digits are not accepted.', 'error', 'dashboard');
        resetButtonLoading('btn-submit-car');
        return;
    }
    if (!validators.plateNumber(plateNum)) {
        showMessage('Error: Plate number must contain digits only.', 'error', 'dashboard');
        resetButtonLoading('btn-submit-car');
        return;
    }
    if (!validators.year(manufactureYear)) {
        showMessage(`Error: Please enter a valid manufacture year (1900-${new Date().getFullYear() + 1}).`, 'error', 'dashboard');
        resetButtonLoading('btn-submit-car');
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
        if (addWrapper) {
            addWrapper.classList.add('hidden-form');
            const toggle = document.getElementById('toggle-add-car');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
        lastVisibleCar = null;
        fetchCars(false);
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error', 'dashboard');
    } finally {
        resetButtonLoading('btn-submit-car');
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
            if (!loadMore) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🚗</div>
                        <p>No cars found.</p>
                    </div>
                `;
            }
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
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>No cars match the current filter.</p>
                </div>
            `;
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
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🚗</div>
                    <p>No cars assigned to you currently.</p>
                </div>
            `;
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
    card.setAttribute('role', 'region');
    card.setAttribute('aria-labelledby', `header-title-${id}`);

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
        'Sharjah': '#ff0000000',
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
                <button type="button" class="action-btn action-btn-edit" data-action="edit" aria-label="Edit car ${escapeHtml(data.carId)}">✎ Edit</button>
                ${data.currentUserId
                    ? '<button type="button" class="action-btn action-btn-unassign" data-action="unassign" aria-label="Unassign user from car">👤 Unassign</button>'
                    : '<button type="button" class="action-btn action-btn-assign" data-action="assign" aria-label="Assign user to car">👤 Assign</button>'}
                <button type="button" class="action-btn action-btn-print" data-action="print" aria-label="Print car card">🖨 Print</button>
                <button type="button" class="action-btn action-btn-history" data-action="history" aria-label="View car history">📋 History</button>
            </div>
            <div id="assign-area-${id}" style="margin-top: 10px; display:none;"></div>
            <div id="edit-area-${id}" style="margin-top: 10px; display:none;"></div>
            <div id="history-area-${id}" style="margin-top: 10px; display:none;"></div>
        `;
    } else {
        actionsHtml = `
            <div class="action-buttons">
                <button type="button" class="action-btn action-btn-unlink" id="req-unlink-${id}" aria-label="Request to unlink car">✎ Request Unlink</button>
                <button type="button" class="action-btn action-btn-history" id="my-history-${id}" aria-label="View my history for this car">📋 My History</button>
            </div>
            <div id="history-area-${id}" style="margin-top: 10px; display:none;"></div>
        `;
    }

    card.innerHTML = `
        <div class="card-header" id="header-${id}" tabindex="0" role="button" aria-expanded="false" aria-controls="body-${id}">
            <div class="card-header-top">
                <div class="card-title" id="header-title-${id}">
                    <div class="plate-wrapper">
                        <div class="plate-meta-top">
                            <span class="plate-id">${escapeHtml(data.carId)}</span>
                            <span class="meta-separator"></span>
                            <span class="plate-owner">Assignee: ${escapeHtml(data.currentUserName || 'Unassigned')}</span>
                        </div>
                        <div class="plate-container">
                            <div style="display:flex; flex-direction:column; align-items:center;">
                                <div class="plate-top-bar" style="background:${escapeHtml(topBarColor)};"></div>
                                <span class="plate-emirate">${escapeHtml(data.emirate)}</span>
                            </div>
                            <span class="plate-number">${escapeHtml(data.plateNumber)}</span>
                            <span class="plate-code">${escapeHtml(data.plateCode)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-body" id="body-${id}">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">${escapeHtml(data.type)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Owner Name</span>
                    <span class="detail-value">${escapeHtml(data.ownerName)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">VIN</span>
                    <span class="detail-value">${escapeHtml(data.vin)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Manufacture Year</span>
                    <span class="detail-value">${data.manufactureYear || 'N/A'}</span>
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
                    <span class="detail-value">${escapeHtml(data.notes) || 'N/A'}</span>
                </div>
            </div>
            <div style="margin-top: 15px;">${actionsHtml}</div>
        </div>
    `;

    listContainer.appendChild(card);

    const headerEl = card.querySelector(`#header-${id}`);
    if (headerEl) {
        const toggleCard = (e) => {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            const isOpen = card.classList.toggle('open');
            headerEl.setAttribute('aria-expanded', isOpen);
        };
        headerEl.addEventListener('click', toggleCard);
        headerEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCard(e);
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
                <label for="edit-plate-num-${carId}">Plate Number</label>
                <input type="text" id="edit-plate-num-${carId}" value="${escapeHtml(data.plateNumber)}" required pattern="\d+" maxlength="6" inputmode="numeric" lang="en" dir="ltr">
            </div>
            <div class="form-group">
                <label for="edit-plate-code-${carId}">Plate Code</label>
                <input type="text" id="edit-plate-code-${carId}" value="${escapeHtml(data.plateCode)}" required maxlength="3">
            </div>
            <div class="form-group">
                <label for="edit-emirate-${carId}">Emirate</label>
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
                <label for="edit-type-${carId}">Type (Make)</label>
                <input type="text" id="edit-type-${carId}" value="${escapeHtml(data.type)}" required>
            </div>
            <div class="form-group">
                <label for="edit-owner-${carId}">Owner Name</label>
                <input type="text" id="edit-owner-${carId}" value="${escapeHtml(data.ownerName)}" required>
            </div>
            <div class="form-group">
                <label for="edit-vin-${carId}">VIN</label>
                <input type="text" id="edit-vin-${carId}" value="${escapeHtml(data.vin)}" required>
            </div>
            <div class="form-group">
                <label for="edit-year-${carId}">Manufacture Year</label>
                <input type="number" id="edit-year-${carId}" value="${data.manufactureYear || ''}" required min="1900" lang="en" dir="ltr" max="${new Date().getFullYear() + 1}">
            </div>
            <div class="form-group">
                <label for="edit-lic-${carId}">License Expiry</label>
                <input type="date" id="edit-lic-${carId}" value="${toDateInputValue(data.licenseExpiry)}" required>
            </div>
            <div class="form-group">
                <label for="edit-ins-${carId}">Insurance Expiry</label>
                <input type="date" id="edit-ins-${carId}" value="${toDateInputValue(data.insuranceExpiry)}" required>
            </div>
            <div class="form-group full-width">
                <label for="edit-notes-${carId}">Notes</label>
                <input type="text" id="edit-notes-${carId}" value="${escapeHtml(data.notes || '')}">
            </div>
            <div class="form-group full-width" style="display:flex; gap:10px;">
                <button type="submit" class="btn btn-sm btn-success" id="edit-save-${carId}">Save Changes</button>
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

    const saveBtn = document.getElementById(`edit-save-${carId}`);
    setButtonLoading(saveBtn, 'Saving...');

    const plateNum = sanitizeInput(`edit-plate-num-${carId}`);
    const plateCode = sanitizeInput(`edit-plate-code-${carId}`, { uppercase: true });
    const emirate = document.getElementById(`edit-emirate-${carId}`).value;
    const type = document.getElementById(`edit-type-${carId}`).value.trim();
    const owner = document.getElementById(`edit-owner-${carId}`).value.trim();
    const vin = document.getElementById(`edit-vin-${carId}`).value.trim().toUpperCase();
    const year = parseInt(document.getElementById(`edit-year-${carId}`).value);
    const licExp = document.getElementById(`edit-lic-${carId}`).value;
    const insExp = document.getElementById(`edit-ins-${carId}`).value;
    const notes = document.getElementById(`edit-notes-${carId}`).value.trim();

    if (!validators.year(year)) {
        showMessage(`Error: Please enter a valid manufacture year (1900-${new Date().getFullYear() + 1}).`, 'error', 'dashboard');
        resetButtonLoading(saveBtn);
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
    } finally {
        resetButtonLoading(saveBtn);
    }
}

function handlePrintCard(data, topBarColor) {
    try {
        const label = formatCarLabel(data);
        const licStr = formatDateOnly(data.licenseExpiry);
        const insStr = formatDateOnly(data.insuranceExpiry);

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Car Card - ${escapeHtml(data.carId)}</title>
    <style>
        @page { margin: 12mm; }
        body { font-family: Arial, sans-serif; padding: 16px; text-align: center; color: #222; }
        .print-header { border-bottom: 2px solid #1976d2; margin-bottom: 16px; padding-bottom: 10px; }
        .print-header h2 { margin: 0; color: #1565c0; font-size: 18px; }
        h3 { margin: 12px 0; font-size: 15px; word-break: break-word; }
        .plate-container { display: inline-flex; align-items: center; gap: 14px; border: 2px solid #ff0000; border-radius: 8px; padding: 10px 18px; margin: 16px 0; }
        .plate-top-bar { width: 100%; height: 5px; margin-bottom: 5px; border-radius: 2px; background: ${escapeHtml(topBarColor || '#666')}; }
        .plate-emirate { font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .plate-number { font-family: 'Courier New', monospace; font-size: 28px; font-weight: bold; letter-spacing: 3px; font-variant-numeric: tabular-nums; width: 7ch; text-align: center; display: inline-block; }
        .plate-code { font-family: 'Courier New', monospace; font-size: 22px; font-weight: bold; color: #fff; background: #ff0000; padding: 2px 8px; border-radius: 4px; letter-spacing: 2px; }
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
    <h3>${escapeHtml(label)}</h3>
    <div class="plate-container">
        <div style="display:flex; flex-direction:column; align-items:center;">
            <div class="plate-top-bar"></div>
            <span class="plate-emirate">${escapeHtml(data.emirate)}</span>
        </div>
        <span class="plate-number">${escapeHtml(data.plateNumber)}</span>
        <span class="plate-code">${escapeHtml(data.plateCode)}</span>
    </div>
    <div class="details">
        <div class="detail-row"><span class="detail-label">Owner Name:</span> <span class="detail-value">${escapeHtml(data.ownerName)}</span></div>
        <div class="detail-row"><span class="detail-label">Type:</span> <span class="detail-value">${escapeHtml(data.type)}</span></div>
        <div class="detail-row"><span class="detail-label">VIN:</span> <span class="detail-value">${escapeHtml(data.vin)}</span></div>
        <div class="detail-row"><span class="detail-label">Manufacture Year:</span> <span class="detail-value">${escapeHtml(data.manufactureYear || 'N/A')}</span></div>
        <div class="detail-row"><span class="detail-label">License Expiry:</span> <span class="detail-value">${escapeHtml(licStr)}</span></div>
        <div class="detail-row"><span class="detail-label">Insurance Expiry:</span> <span class="detail-value">${escapeHtml(insStr)}</span></div>
        <div class="detail-row"><span class="detail-label">Current Assignee:</span> <span class="detail-value">${escapeHtml(data.currentUserName || 'Unassigned')}</span></div>
        <div class="detail-row"><span class="detail-label">Notes:</span> <span class="detail-value">${escapeHtml(data.notes || 'N/A')}</span></div>
    </div>
</body>
</html>`;

        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) {
            showMessage('Please allow popups to print.', 'warning', 'dashboard');
            return;
        }
        printWin.document.open();
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        const doPrint = () => {
            try {
                printWin.print();
            } catch (e) {
                showMessage('Error: Unable to open print dialog.', 'error', 'dashboard');
            }
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
                        <strong>${escapeHtml(a.userName)}</strong><br>
                        ${period}
                    </div>
                `;
            });
        }

        html += '</div>';
        historyArea.innerHTML = html;
    } catch (error) {
        historyArea.innerHTML = `<p class="error" style="font-size:0.85rem;">Error loading history: ${escapeHtml(error.message)}</p>`;
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
                        <span class="timestamp-meta">${date}</span>
                    </div>
                `;
            });
        }

        html += '</div>';
        historyArea.innerHTML = html;

    } catch (error) {
        console.error(error);
        historyArea.innerHTML = `<p class="error" style="font-size:0.85rem;">Error loading history: ${escapeHtml(error.message)}</p>`;
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
            options += `<option value="${d.id}">${escapeHtml(u.username)} (${u.role})</option>`;
        });

        assignArea.innerHTML = `
            <select class="action-select" id="select-user-${carId}" aria-label="Select user to assign">${options}</select>
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

            setButtonLoading(confirmAssignBtn, 'Assigning...');

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
            } finally {
                resetButtonLoading(confirmAssignBtn);
            }
        });
    } catch (err) {
        assignArea.innerHTML = `<p class="error" style="font-size:0.85rem;">Error: ${escapeHtml(err.message)}</p>`;
    }
}

async function handleUnassignUser(carId, data) {
    if (!data.currentUserId || !isAdmin(currentUserData)) return;

    renderConfirmDialog({
        title: 'Confirm Unassign',
        message: `Are you sure you want to unassign "${escapeHtml(data.currentUserName)}" from this car?`,
        confirmText: 'Unassign',
        cancelText: 'Cancel',
        danger: true,
        onConfirm: async () => {
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
    });
}
