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
import { createLinkRequest as originalCreateLinkRequest, createUnlinkRequest } from "./requests.js";
import {
    showMessage, handleFirebaseError, formatDateTime, formatDateOnly,
    formatPeriod, formatCarLabel as baseFormatCarLabel, isAdmin, isActiveUser, renderAccessDenied,
    daysUntil, expiryClass, toDateInputValue,
    t, lockUI, unlockUI
} from "./utils.js";
import { updateRequestsBadge } from "./app.js";

let currentUserData = null;
let lastVisibleCar = null;

export const setCarsCurrentUser = (data) => { currentUserData = data; };

// استخدام دالة formatCarLabel المعدلة
const formatCarLabel = baseFormatCarLabel;

export function renderCarsView() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    if (!isActiveUser(currentUserData)) {
        renderAccessDenied();
        return;
    }

    if (isAdmin(currentUserData)) {
        container.innerHTML = `
            <h2>${t('cars.title')}</h2>
            <div class="divider"></div>
            
            <div class="cars-filters" id="cars-filters">
                <button class="filter-btn active" data-filter="all">${t('cars.all')}</button>
                <button class="filter-btn" data-filter="expired">${t('cars.expired')}</button>
                <button class="filter-btn" data-filter="warning">${t('cars.expiringSoon')}</button>
                <button class="filter-btn" data-filter="assigned">${t('cars.assigned')}</button>
                <button class="filter-btn" data-filter="unassigned">${t('cars.unassigned')}</button>
            </div>

            <button class="btn-add-toggle" id="toggle-add-car">${t('cars.addNew')}</button>
            <div id="add-car-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
                <form id="add-car-form">
                    <div class="form-group">
                        <label>${t('cars.plateNumber')}</label>
                        <input type="text" id="car-plate-num" required pattern="\\d+" maxlength="6" placeholder="e.g. 12345">
                    </div>
                    <div class="form-group">
                        <label>${t('cars.plateCode')}</label>
                        <input type="text" id="car-plate-code" required maxlength="3" placeholder="e.g. A">
                    </div>
                    <div class="form-group">
                        <label>${t('cars.emirate')}</label>
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
                        <label>${t('cars.type')}</label>
                        <input type="text" id="car-type" required placeholder="e.g. Toyota Camry">
                    </div>
                    <div class="form-group">
                        <label>${t('cars.ownerName')}</label>
                        <input type="text" id="car-owner" required>
                    </div>
                    <div class="form-group">
                        <label>${t('cars.vin')}</label>
                        <input type="text" id="car-vin" required placeholder="Vehicle Identification Number">
                    </div>
                    <div class="form-group">
                        <label>${t('cars.manufactureYear')}</label>
                        <input type="number" id="car-year" required min="1900" max="2026" placeholder="e.g. 2020">
                    </div>
                    <div class="form-group">
                        <label>${t('cars.licenseExpiry')}</label>
                        <input type="date" id="car-license-exp" required>
                    </div>
                    <div class="form-group">
                        <label>${t('cars.insuranceExpiry')}</label>
                        <input type="date" id="car-insurance-exp" required>
                    </div>
                    <div class="form-group">
                        <label>${t('cars.notes')}</label>
                        <input type="text" id="car-notes">
                    </div>
                    <div class="form-group">
                        <button type="submit" class="btn" id="btn-submit-car">${t('cars.addCar')}</button>
                    </div>
                </form>
            </div>
            <h3>${t('cars.title')}</h3>
            <div id="cars-card-list" class="card-list">
                <p class="loading-text">${t('common.loading')}</p>
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
            <h2>${t('cars.myCars')}</h2>
            <div class="divider"></div>
            <button class="btn-add-toggle" id="toggle-request-car">+ ${t('cars.requestUnlink')}</button>
            <div id="request-car-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
                <form id="request-car-form">
                    <div class="form-group">
                        <label>${t('cars.plateNumber')}</label>
                        <input type="text" id="req-plate-num" required pattern="\\d+" maxlength="6">
                    </div>
                    <div class="form-group">
                        <label>${t('cars.plateCode')}</label>
                        <input type="text" id="req-plate-code" required maxlength="3">
                    </div>
                    <div class="form-group">
                        <label>${t('cars.emirate')}</label>
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
                        <button type="submit" class="btn" id="btn-submit-req">${t('cars.sendRequest')}</button>
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
            requestCarForm.addEventListener('submit', createLinkRequestWrapper);
        }
        fetchUserCars();
    }
}

// ====== دوال مساعدة لـ handleAddCar ======

function validateCarFormInputs() {
    const plateNum = document.getElementById('car-plate-num').value.trim();
    const plateCode = document.getElementById('car-plate-code').value.trim().toUpperCase();
    const emirate = document.getElementById('car-emirate').value;
    const type = document.getElementById('car-type').value.trim();
    const owner = document.getElementById('car-owner').value.trim();
    const vin = document.getElementById('car-vin').value.trim().toUpperCase();
    const year = parseInt(document.getElementById('car-year').value);
    const licenseExp = document.getElementById('car-license-exp').value;
    const insuranceExp = document.getElementById('car-insurance-exp').value;
    const notes = document.getElementById('car-notes').value.trim();

    if (isNaN(year) || year < 1900 || year > 2026) {
        showMessage(t('error.invalidYear'), 'error', 'dashboard');
        return null;
    }
    if (!/^\d{1,6}$/.test(plateNum) || !/^[A-Z0-9]{1,3}$/.test(plateCode)) {
        showMessage(t('error.general'), 'error', 'dashboard');
        return null;
    }
    return {
        plateNum, plateCode, emirate, type, owner, vin, year, licenseExp, insuranceExp, notes,
        plateIdentifier: `${plateNum}-${plateCode.toLowerCase()}-${emirate.toLowerCase()}`
    };
}

async function checkCarUniqueness(plateIdentifier, vin) {
    const plateQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier));
    const plateSnap = await getDocs(plateQ);
    if (!plateSnap.empty) throw new Error(t('error.plateExists'));

    const vinQ = query(collection(db, 'cars'), where('vin', '==', vin));
    const vinSnap = await getDocs(vinQ);
    if (!vinSnap.empty) throw new Error(t('error.vinExists'));
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

async function saveNewCar(carData, carId) {
    await setDoc(doc(db, 'cars', carId), {
        carId,
        plateNumber: carData.plateNum,
        plateCode: carData.plateCode,
        emirate: carData.emirate,
        plateIdentifier: carData.plateIdentifier,
        type: carData.type,
        ownerName: carData.owner,
        vin: carData.vin,
        manufactureYear: carData.year,
        licenseExpiry: new Date(carData.licenseExp),
        insuranceExpiry: new Date(carData.insuranceExp),
        notes: carData.notes,
        currentUserId: null,
        currentUserName: null,
        status: 'active',
        createdAt: serverTimestamp(),
        lastTransferredAt: null
    });
    return carId;
}

// ====== دالة handleAddCar المُعدلة ======

async function handleAddCar(e) {
    e.preventDefault();
    if (!isAdmin(currentUserData)) return;

    const submitBtn = document.getElementById('btn-submit-car');
    if (!submitBtn || submitBtn.disabled) return;

    submitBtn.disabled = true;
    submitBtn.textContent = t('common.processing');
    lockUI();

    try {
        const carData = validateCarFormInputs();
        if (!carData) return;

        await checkCarUniqueness(carData.plateIdentifier, carData.vin);

        const carId = await generateCarId();
        await saveNewCar(carData, carId);

        const label = formatCarLabel({ carId, plateNumber: carData.plateNum, plateCode: carData.plateCode, emirate: carData.emirate });
        await logAction(currentUserData, 'CREATE_CAR', {
            targetId: carId,
            targetName: label,
            text: t('cars.carAdded')
        });

        showMessage(t('cars.carAdded'), 'success', 'dashboard');
        document.getElementById('add-car-form').reset();
        document.getElementById('add-car-form-wrapper').classList.add('hidden-form');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (error) {
        showMessage(error.message, 'error', 'dashboard');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = t('cars.addCar');
        unlockUI();
    }
}

// ====== Fetch Cars ======

async function fetchCars(loadMore = false) {
    if (!isAdmin(currentUserData)) return;

    const listContainer = document.getElementById('cars-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!listContainer) return;

    if (!loadMore) listContainer.innerHTML = `<p class="loading-text">${t('common.loading')}</p>`;

    try {
        let q;
        if (loadMore && lastVisibleCar) {
            q = query(collection(db, 'cars'), orderBy('licenseExpiry', 'asc'), startAfter(lastVisibleCar), limit(10));
        } else {
            q = query(collection(db, 'cars'), orderBy('licenseExpiry', 'asc'), limit(10));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            if (!loadMore) listContainer.innerHTML = `<p style="text-align:center; color:#666;">${t('cars.noCars')}</p>`;
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
            listContainer.innerHTML = `<p style="text-align:center; color:#666;">${t('cars.noCarsMatch')}</p>`;
        } else {
            docs.forEach((d) => renderCarCard(d.id, d.data(), false));
        }

        if (loadMoreContainer) {
            if (snapshot.size === 10) {
                loadMoreContainer.innerHTML = `<button class="load-more-btn" id="load-more-btn">${t('common.loadMore')}</button>`;
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
            listContainer.innerHTML = `<p class="error">${t('error.loadFailed')} ${error.message}</p>`;
        }
    }
}

async function fetchUserCars() {
    if (!isActiveUser(currentUserData)) return;

    const listContainer = document.getElementById('cars-card-list');
    if (!listContainer) return;

    listContainer.innerHTML = `<p class="loading-text">${t('common.loading')}</p>`;

    try {
        const q = query(collection(db, 'cars'), where('currentUserId', '==', currentUserData.uid));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            listContainer.innerHTML = `<p style="text-align:center; color:#666;">${t('members.noCarsAssigned')}</p>`;
            return;
        }

        listContainer.innerHTML = '';
        snapshot.forEach((d) => renderCarCard(d.id, d.data(), true));
    } catch (error) {
        listContainer.innerHTML = `<p class="error">${t('error.loadFailed')} ${error.message}</p>`;
    }
}

// ====== Render Car Card ======

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
                <button type="button" class="action-btn action-btn-edit" data-action="edit">${t('common.edit')}</button>
                ${data.currentUserId
                    ? `<button type="button" class="action-btn action-btn-unassign" data-action="unassign">${t('cars.unassign')}</button>`
                    : `<button type="button" class="action-btn action-btn-assign" data-action="assign">${t('cars.assign')}</button>`}
                <button type="button" class="action-btn action-btn-print" data-action="print">${t('cars.print')}</button>
                <button type="button" class="action-btn action-btn-history" data-action="history">${t('cars.history')}</button>
            </div>
            <div id="assign-area-${id}" style="margin-top: 10px; display:none;"></div>
            <div id="edit-area-${id}" style="margin-top: 10px; display:none;"></div>
            <div id="history-area-${id}" style="margin-top: 10px; display:none;"></div>
        `;
    } else {
        actionsHtml = `
            <div class="action-buttons">
                <button type="button" class="action-btn action-btn-unlink" id="req-unlink-${id}">${t('cars.requestUnlink')}</button>
                <button type="button" class="action-btn action-btn-history" id="my-history-${id}">${t('cars.myHistory')}</button>
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
                            <span class="plate-owner">${t('cars.carAssignedTo', { userName: data.currentUserName || t('cars.unassigned') })}</span>
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
                    <span class="detail-label">${t('cars.type')}</span>
                    <span class="detail-value">${data.type}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('cars.ownerName')}</span>
                    <span class="detail-value">${data.ownerName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('cars.vin')}</span>
                    <span class="detail-value">${data.vin}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('cars.manufactureYear')}</span>
                    <span class="detail-value">${data.manufactureYear || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('cars.licenseExpiry')}</span>
                    <span class="detail-value ${licClass}">${formatDateOnly(data.licenseExpiry)} (${licDiff} ${t('common.daysLeft') || 'days left'})</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('cars.insuranceExpiry')}</span>
                    <span class="detail-value ${insClass}">${formatDateOnly(data.insuranceExpiry)} (${insDiff} ${t('common.daysLeft') || 'days left'})</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">${t('cars.notes')}</span>
                    <span class="detail-value">${data.notes || t('common.none')}</span>
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
            createUnlinkRequestWrapper(id, data);
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

// ====== Car Actions ======

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

// ====== Edit Car Form ======

function renderEditCarForm(carId, data) {
    const editArea = document.getElementById(`edit-area-${carId}`);
    if (!editArea) return;

    editArea.style.display = 'block';
    editArea.innerHTML = `
        <h4>${t('common.edit')}</h4>
        <form id="edit-car-form-${carId}" class="edit-car-form">
            <div class="form-group">
                <label>${t('cars.plateNumber')}</label>
                <input type="text" id="edit-plate-num-${carId}" value="${data.plateNumber}" required pattern="\\d+" maxlength="6">
            </div>
            <div class="form-group">
                <label>${t('cars.plateCode')}</label>
                <input type="text" id="edit-plate-code-${carId}" value="${data.plateCode}" required maxlength="3">
            </div>
            <div class="form-group">
                <label>${t('cars.emirate')}</label>
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
                <label>${t('cars.type')}</label>
                <input type="text" id="edit-type-${carId}" value="${data.type}" required>
            </div>
            <div class="form-group">
                <label>${t('cars.ownerName')}</label>
                <input type="text" id="edit-owner-${carId}" value="${data.ownerName}" required>
            </div>
            <div class="form-group">
                <label>${t('cars.vin')}</label>
                <input type="text" id="edit-vin-${carId}" value="${data.vin}" required>
            </div>
            <div class="form-group">
                <label>${t('cars.manufactureYear')}</label>
                <input type="number" id="edit-year-${carId}" value="${data.manufactureYear || ''}" required min="1900" max="2026">
            </div>
            <div class="form-group">
                <label>${t('cars.licenseExpiry')}</label>
                <input type="date" id="edit-lic-${carId}" value="${toDateInputValue(data.licenseExpiry)}" required>
            </div>
            <div class="form-group">
                <label>${t('cars.insuranceExpiry')}</label>
                <input type="date" id="edit-ins-${carId}" value="${toDateInputValue(data.insuranceExpiry)}" required>
            </div>
            <div class="form-group full-width">
                <label>${t('cars.notes')}</label>
                <input type="text" id="edit-notes-${carId}" value="${data.notes || ''}">
            </div>
            <div class="form-group full-width" style="display:flex; gap:10px;">
                <button type="submit" class="btn btn-sm btn-success">${t('common.save')}</button>
                <button type="button" class="btn btn-sm btn-secondary" id="cancel-edit-${carId}">${t('common.cancel')}</button>
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
    const year = parseInt(document.getElementById(`edit-year-${carId}`).value);
    const licExp = document.getElementById(`edit-lic-${carId}`).value;
    const insExp = document.getElementById(`edit-ins-${carId}`).value;
    const notes = document.getElementById(`edit-notes-${carId}`).value.trim();

    if (isNaN(year) || year < 1900 || year > 2026) {
        showMessage(t('error.invalidYear'), 'error', 'dashboard');
        return;
    }

    const plateIdentifier = `${plateNum}-${plateCode.toLowerCase()}-${emirate.toLowerCase()}`;

    lockUI();
    try {
        if (plateIdentifier !== originalData.plateIdentifier) {
            const plateQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier));
            const plateSnap = await getDocs(plateQ);
            if (!plateSnap.empty) throw new Error(t('error.plateExists'));
        }

        if (vin !== originalData.vin) {
            const vinQ = query(collection(db, 'cars'), where('vin', '==', vin));
            const vinSnap = await getDocs(vinQ);
            if (!vinSnap.empty) throw new Error(t('error.vinExists'));
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
            text: t('cars.carUpdated')
        });

        showMessage(t('cars.carUpdated'), 'success', 'dashboard');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (error) {
        showMessage(error.message, 'error', 'dashboard');
    } finally {
        unlockUI();
    }
}

// ====== Print Card ======

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
        .plate-container { display: inline-flex; align-items: center; gap: 14px; border: 2px solid #ff0000; border-radius: 8px; padding: 10px 18px; margin: 16px 0; }
        .plate-top-bar { width: 100%; height: 5px; margin-bottom: 5px; border-radius: 2px; background: ${topBarColor || '#666'}; }
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
        <h2>${t('cars.title')}</h2>
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
        <div class="detail-row"><span class="detail-label">${t('cars.ownerName')}:</span> <span class="detail-value">${safe(data.ownerName)}</span></div>
        <div class="detail-row"><span class="detail-label">${t('cars.type')}:</span> <span class="detail-value">${safe(data.type)}</span></div>
        <div class="detail-row"><span class="detail-label">${t('cars.vin')}:</span> <span class="detail-value">${safe(data.vin)}</span></div>
        <div class="detail-row"><span class="detail-label">${t('cars.manufactureYear')}:</span> <span class="detail-value">${safe(data.manufactureYear || 'N/A')}</span></div>
        <div class="detail-row"><span class="detail-label">${t('cars.licenseExpiry')}:</span> <span class="detail-value">${safe(licStr)}</span></div>
        <div class="detail-row"><span class="detail-label">${t('cars.insuranceExpiry')}:</span> <span class="detail-value">${safe(insStr)}</span></div>
        <div class="detail-row"><span class="detail-label">${t('cars.assign')}:</span> <span class="detail-value">${safe(data.currentUserName || t('cars.unassigned'))}</span></div>
        <div class="detail-row"><span class="detail-label">${t('cars.notes')}:</span> <span class="detail-value">${safe(data.notes || 'N/A')}</span></div>
    </div>
</body>
</html>`;

        const printWin = window.open('', '_blank', 'width=900,height=700');
        if (!printWin) {
            showMessage(t('error.general'), 'warning', 'dashboard');
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
                showMessage(t('error.general'), 'error', 'dashboard');
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
        showMessage(`${t('error.general')} ${error.message}`, 'error', 'dashboard');
    }
}

// ====== Car History ======

async function renderCarHistory(carId, carData) {
    const historyArea = document.getElementById(`history-area-${carId}`);
    if (!historyArea) return;

    historyArea.style.display = 'block';
    historyArea.innerHTML = `<p class="loading-text" style="font-size: 0.85rem;">${t('common.loading')}</p>`;

    const carLabel = formatCarLabel(carData);
    let html = `<div class="history-list"><h4>${t('cars.historyFor', { carLabel })}</h4>`;

    try {
        const logsQuery = query(collection(db, 'logs'), where('targetId', '==', carId), limit(20));
        const logsSnap = await getDocs(logsQuery);

        if (logsSnap.empty) {
            html += `<p class="history-item">${t('cars.noHistory')}</p>`;
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
                        <span class="action-type">${log.actionType}</span> ${t('common.by')} ${log.actorName}<br>
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
            html += `<h4 style="margin-top: 15px;">${t('cars.assignmentPeriods')}</h4>`;
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
        historyArea.innerHTML = `<p class="error" style="font-size:0.85rem;">${t('error.loadFailed')}</p>`;
    }
}

async function renderMyCarHistory(carId, carData) {
    const historyArea = document.getElementById(`history-area-${carId}`);
    if (!historyArea) return;

    historyArea.style.display = 'block';
    historyArea.innerHTML = `<p class="loading-text" style="font-size: 0.85rem;">${t('common.loading')}</p>`;

    const carLabel = formatCarLabel(carData);
    let html = `<div class="history-list"><h4>${t('cars.myHistory')} ${carLabel}</h4>`;

    try {
        const assignQuery = query(
            collection(db, 'cars', carId, 'assignments'),
            where('userId', '==', currentUserData.uid),
            limit(20)
        );
        const assignSnap = await getDocs(assignQuery);

        if (assignSnap.empty) {
            html += `<p class="history-item">${t('cars.noHistory')}</p>`;
        } else {
            const assignments = [];
            assignSnap.forEach(doc => assignments.push(doc.data()));

            assignments.sort((a, b) => {
                const tA = a.startTime ? (a.startTime.toDate ? a.startTime.toDate().getTime() : new Date(a.startTime).getTime()) : 0;
                const tB = b.startTime ? (b.startTime.toDate ? b.startTime.toDate().getTime() : new Date(b.startTime).getTime()) : 0;
                return tB - tA;
            });

            html += `<h4 style="margin-top: 10px;">${t('cars.myAssignmentPeriods')}</h4>`;
            assignments.slice(0, 10).forEach(a => {
                const period = formatPeriod(a.startTime, a.endTime);
                html += `
                    <div class="history-item">
                        <strong>${t('common.you')}</strong><br>
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
            html += `<h4 style="margin-top: 15px;">${t('cars.relatedActivity')}</h4>`;
            uniqueLogs.slice(0, 8).forEach(log => {
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
        console.error(error);
        historyArea.innerHTML = `<p class="error" style="font-size:0.85rem;">${t('error.loadFailed')}</p>`;
    }
}

// ====== Assign User UI ======

async function renderAssignUserUI(carId) {
    const assignArea = document.getElementById(`assign-area-${carId}`);
    if (!assignArea) return;

    assignArea.style.display = 'block';
    assignArea.innerHTML = `<p class="loading-text" style="font-size: 0.85rem;">${t('common.loading')}</p>`;

    try {
        const q = query(collection(db, 'users'), where('status', '==', 'active'));
        const snapshot = await getDocs(q);

        let options = `<option value="">${t('cars.selectUser')}</option>`;
        snapshot.forEach(d => {
            const u = d.data();
            options += `<option value="${d.id}">${u.username} (${u.role})</option>`;
        });

        assignArea.innerHTML = `
            <select class="action-select" id="select-user-${carId}">${options}</select>
            <button class="btn btn-sm btn-success" id="confirm-assign-${carId}" style="margin-top: 10px;">${t('cars.confirmAssign')}</button>
        `;

        const confirmAssignBtn = document.getElementById(`confirm-assign-${carId}`);
        if (!confirmAssignBtn) return;

        confirmAssignBtn.addEventListener('click', async () => {
            const selectUser = document.getElementById(`select-user-${carId}`);
            const userId = selectUser ? selectUser.value : '';
            if (!userId) {
                showMessage(t('error.selectUser'), 'warning', 'dashboard');
                return;
            }

            lockUI();
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (!userDoc.exists()) throw new Error(t('error.userNotFoundFirestore'));
                const userName = userDoc.data().username;

                const carDoc = await getDoc(doc(db, 'cars', carId));
                const carData = carDoc.data();
                const label = formatCarLabel(carData);

                await updateDoc(doc(db, 'cars', carId), {
                    currentUserId: userId,
                    currentUserName: userName,
                    lastTransferredAt: serverTimestamp()
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
                    text: t('cars.carAssignedTo', { userName })
                });

                showMessage(t('cars.assignSuccess'), 'success', 'dashboard');
                lastVisibleCar = null;
                fetchCars(false);
            } catch (err) {
                showMessage(err.message, 'error', 'dashboard');
            } finally {
                unlockUI();
            }
        });
    } catch (err) {
        assignArea.innerHTML = `<p class="error" style="font-size:0.85rem;">${t('error.loadFailed')}</p>`;
    }
}

// ====== Unassign User ======

async function handleUnassignUser(carId, data) {
    if (!data.currentUserId || !isAdmin(currentUserData)) return;

    if (!confirm(t('cars.unassignConfirm', { userName: data.currentUserName }))) {
        return;
    }

    lockUI();
    try {
        const label = formatCarLabel(data);

        await updateDoc(doc(db, 'cars', carId), {
            currentUserId: null,
            currentUserName: null,
            lastTransferredAt: serverTimestamp()
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
            text: t('cars.carUnassignedFrom', { userName: data.currentUserName })
        });

        showMessage(t('cars.unassignedSuccess'), 'success', 'dashboard');
        lastVisibleCar = null;
        fetchCars(false);
    } catch (err) {
        showMessage(err.message, 'error', 'dashboard');
    } finally {
        unlockUI();
    }
}

// ====== createLinkRequest Wrapper (مع رسالة التأكيد والتحسينات) ======

export async function createLinkRequestWrapper(e) {
    e.preventDefault();
    if (!isActiveUser(currentUserData)) return;

    const btn = document.getElementById('btn-submit-req');
    if (!btn || btn.disabled) return;

    btn.disabled = true;
    btn.textContent = t('common.processing');
    lockUI();

    try {
        const plateNum = document.getElementById('req-plate-num').value.trim();
        const plateCode = document.getElementById('req-plate-code').value.trim().toUpperCase();
        const emirate = document.getElementById('req-emirate').value.trim();

        const plateIdentifier = `${plateNum}-${plateCode.toLowerCase()}-${emirate.toLowerCase()}`;
        const carQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier));
        const carSnap = await getDocs(carQ);

        if (!carSnap.empty) {
            const carDoc = carSnap.docs[0];
            const carData = carDoc.data();
            const label = formatCarLabel(carData);

            // رسالة تأكيد بدون عرض اسم المستخدم الحالي
            if (!confirm(t('cars.takeoverConfirm'))) {
                return;
            }

            const oldUserId = carData.currentUserId;
            const oldUserName = carData.currentUserName;

            // تنفيذ الاستحواذ
            await updateDoc(doc(db, 'cars', carDoc.id), {
                currentUserId: currentUserData.uid,
                currentUserName: currentUserData.username,
                lastTransferredAt: serverTimestamp()
            });

            // إنهاء عهدة المستخدم السابق
            if (oldUserId) {
                const prevAssignQ = query(
                    collection(db, 'cars', carDoc.id, 'assignments'),
                    where('userId', '==', oldUserId),
                    where('endTime', '==', null),
                    limit(1)
                );
                const prevSnap = await getDocs(prevAssignQ);
                if (!prevSnap.empty) {
                    await updateDoc(doc(db, 'cars', carDoc.id, 'assignments', prevSnap.docs[0].id), {
                        endTime: serverTimestamp()
                    });
                }
            }

            // إضافة عهدة جديدة
            await addDoc(collection(db, 'cars', carDoc.id, 'assignments'), {
                userId: currentUserData.uid,
                userName: currentUserData.username,
                startTime: serverTimestamp(),
                endTime: null
            });

            // سجل مميز للاستحواذ
            await logAction(currentUserData, 'CAR_TAKEOVER', {
                targetId: carDoc.id,
                targetName: label,
                assigneeId: currentUserData.uid,
                text: t('cars.carTakenOver', {
                    carLabel: label,
                    newUser: currentUserData.username,
                    oldUser: oldUserName || 'unknown'
                })
            });

            showMessage(t('cars.takeoverSuccess'), 'success', 'dashboard');
            document.getElementById('request-car-form').reset();
            document.getElementById('request-car-form-wrapper').classList.add('hidden-form');
            renderCarsView();

        } else {
            // السيارة غير موجودة -> إنشاء طلب عادي
            await addDoc(collection(db, 'requests'), {
                type: 'LINK',
                userId: currentUserData.uid,
                userName: currentUserData.username,
                plateNumber: plateNum,
                plateCode: plateCode,
                emirate: emirate,
                status: 'PENDING',
                timestamp: serverTimestamp()
            });

            await logAction(currentUserData, 'REQUEST_LINK', {
                targetName: `${plateNum} ${plateCode} (${emirate})`,
                text: t('cars.requestSent')
            });

            showMessage(t('cars.requestSent'), 'success', 'dashboard');
            document.getElementById('request-car-form').reset();
            document.getElementById('request-car-form-wrapper').classList.add('hidden-form');
            updateRequestsBadge();
        }
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    } finally {
        btn.disabled = false;
        btn.textContent = t('cars.sendRequest');
        unlockUI();
    }
}

// ====== createUnlinkRequest Wrapper ======

export async function createUnlinkRequestWrapper(carId, carData) {
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