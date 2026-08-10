import { db } from "./firebase.js";
import { 
    collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
    query, where, limit, startAfter, orderBy, runTransaction, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";

let currentUserData = null;
let lastVisibleCar = null;

export const setCarsCurrentUser = (data) => currentUserData = data;

export function renderCarsView() {
    const container = document.getElementById('dashboard-container');
    
    if (currentUserData.role === 'admin') {
        container.innerHTML = `
            <h2>Cars Management</h2>
            <div class="divider"></div>
            <button class="btn-add-toggle" id="toggle-add-car">+ Add New Car</button>
            <div id="add-car-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
                <form id="add-car-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div class="form-group"><label>Plate Number (Digits)</label><input type="text" id="car-plate-num" required pattern="\\d+"></div>
                    <div class="form-group"><label>Plate Code</label><input type="text" id="car-plate-code" required></div>
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
                    <div class="form-group"><label>Type (Make)</label><input type="text" id="car-type" required></div>
                    <div class="form-group"><label>Owner Name</label><input type="text" id="car-owner" required></div>
                    <div class="form-group"><label>VIN (Unique)</label><input type="text" id="car-vin" required></div>
                    <div class="form-group"><label>License Expiry</label><input type="date" id="car-license-exp" required></div>
                    <div class="form-group"><label>Insurance Expiry</label><input type="date" id="car-insurance-exp" required></div>
                    <div class="form-group" style="grid-column: 1 / -1;"><label>Notes</label><input type="text" id="car-notes"></div>
                    <div class="form-group" style="Grid-column: 1 / -1;"><button type="submit" class="btn">Add Car</button></div>
                </form>
            </div>
            <h3>Cars List (Sorted by Expiry)</h3>
            <div id="cars-card-list" class="card-list"><p class="loading-text">Loading cars...</p></div>
            <div id="load-more-container" class="load-more-container"></div>
        `;
        
        document.getElementById('toggle-add-car').addEventListener('click', () => {
            document.getElementById('add-car-form-wrapper').classList.toggle('hidden-form');
        });
        document.getElementById('add-car-form').addEventListener('submit', handleAddCar);
        lastVisibleCar = null;
        fetchCars(false);
    } else {
        container.innerHTML = `
            <h2>My Assigned Cars</h2>
            <div id="cars-card-list" class="card-list"></div>
        `;
        fetchUserCars();
    }
}

async function generateCarId() {
    const counterRef = doc(db, 'counters', 'carId');
    try {
        const newCount = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) { transaction.set(counterRef, { count: 1 }); return 1; }
            const newCount = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: newCount });
            return newCount;
        });
        return `UAE-${newCount.toString().padStart(3, '0')}`;
    } catch (e) { console.error("Transaction failed: ", e); throw e; }
}

async function handleAddCar(e) {
    e.preventDefault();
    const plateNum = document.getElementById('car-plate-num').value.trim();
    const plateCode = document.getElementById('car-plate-code').value.trim();
    const emirate = document.getElementById('car-emirate').value.trim();
    const type = document.getElementById('car-type').value.trim();
    const owner = document.getElementById('car-owner').value.trim();
    const vin = document.getElementById('car-vin').value.trim();
    const licenseExp = document.getElementById('car-license-exp').value;
    const insuranceExp = document.getElementById('car-insurance-exp').value;
    const notes = document.getElementById('car-notes').value.trim();

    const plateIdentifier = `${plateNum}-${plateCode}-${emirate}`.toLowerCase();

    try {
        const plateQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier));
        const plateSnap = await getDocs(plateQ);
        if (!plateSnap.empty) return showMessage('Error: This Plate combination already exists.', 'error', 'dashboard');

        const vinQ = query(collection(db, 'cars'), where('vin', '==', vin.toLowerCase()));
        const vinSnap = await getDocs(vinQ);
        if (!vinSnap.empty) return showMessage('Error: This VIN already exists.', 'error', 'dashboard');

        const carId = await generateCarId();

        await setDoc(doc(db, 'cars', carId), {
            carId, plateNumber: plateNum, plateCode: plateCode, emirate, plateIdentifier, type, ownerName: owner, vin,
            licenseExpiry: new Date(licenseExp), insuranceExpiry: new Date(insuranceExp),
            notes, currentUserId: null, currentUserName: null, status: 'active'
        });

        await logAction(currentUserData, 'CREATE_CAR', { targetId: carId, targetName: plateNum, text: `Created car ${carId} (${plateNum})` });
        showMessage('Success: Car added successfully.', 'success', 'dashboard');
        document.getElementById('add-car-form').reset();
        document.getElementById('add-car-form-wrapper').classList.add('hidden-form');
        lastVisibleCar = null; fetchCars(false);
    } catch (error) { showMessage(`System Error: ${error.message}`, 'error', 'dashboard'); }
}

async function fetchCars(loadMore = false) {
    const listContainer = document.getElementById('cars-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!loadMore) listContainer.innerHTML = '<p class="loading-text">Loading cars...</p>';

    try {
        let q = (loadMore && lastVisibleCar) ? query(collection(db, 'cars'), orderBy('licenseExpiry', 'asc'), startAfter(lastVisibleCar), limit(10)) : query(collection(db, 'cars'), orderBy('licenseExpiry', 'asc'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            if (!loadMore) listContainer.innerHTML = '<p style="text-align:center; color:#666;">No cars found.</p>';
            loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleCar = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';
        snapshot.forEach((d) => renderCarCard(d.id, d.data()));

        if (snapshot.size === 10) {
            loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load More</button>';
            document.getElementById('load-more-btn').addEventListener('click', () => fetchCars(true));
        } else { loadMoreContainer.innerHTML = ''; }
    } catch (error) { listContainer.innerHTML = `<p class="error">Error loading cars: ${error.message}</p>`; }
}

async function fetchUserCars() {
    const listContainer = document.getElementById('cars-card-list');
    listContainer.innerHTML = '<p class="loading-text">Loading your cars...</p>';
    try {
        const q = query(collection(db, 'cars'), where('currentUserId', '==', currentUserData.uid));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { listContainer.innerHTML = '<p style="text-align:center; color:#666;">No cars assigned to you currently.</p>'; return; }
        listContainer.innerHTML = '';
        snapshot.forEach(d => renderCarCard(d.id, d.data(), true));
    } catch (error) { listContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`; }
}

function renderCarCard(id, data, isUserView = false) {
    const listContainer = document.getElementById('cars-card-list');
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${id}`;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const licDiff = Math.ceil((data.licenseExpiry.toDate() - today) / (1000 * 60 * 60 * 24));
    const insDiff = Math.ceil((data.insuranceExpiry.toDate() - today) / (1000 * 60 * 60 * 24));
    const minDiff = Math.min(licDiff, insDiff);

    if (minDiff < 0) card.classList.add('border-red');
    else if (minDiff <= 15) card.classList.add('border-yellow');

    const licClass = licDiff < 0 ? 'date-expired' : licDiff <= 15 ? 'date-warning' : 'date-valid';
    const insClass = insDiff < 0 ? 'date-expired' : insDiff <= 15 ? 'date-warning' : 'date-valid';

    const emirateColors = { 'Abu Dhabi': '#0070c0', 'Dubai': '#b91d1d', 'Sharjah': '#000000', 'Ajman': '#ed1c24', 'Fujairah': '#8a2be2', 'Umm Al Quwain': '#006400', 'Ras Al Khaimah': '#ff8c00', 'Other': '#666666' };
    const topBarColor = emirateColors[data.emirate] || '#666666';

    let actionsHtml = '';
    if (!isUserView) {
        actionsHtml = `
            <select class="action-select" id="car-action-${id}">
                <option value="">Select Action</option>
                <option value="edit">Edit Car</option>
                ${data.currentUserId ? '<option value="unassign">Unassign User</option>' : '<option value="assign">Assign User</option>'}
                <option value="print">Print Card</option>
                <option value="history">View History</option>
            </select>
            <div id="assign-area-${id}" style="margin-top: 10px; display:none;"></div>
        `;
    }

    card.innerHTML = `
        <div class="card-header" id="header-${id}">
            <div class="card-title">
                <div class="plate-wrapper">
                    <span class="plate-id">${data.carId}</span>
                    <div class="plate-container">
                        <div style="display:flex; flex-direction:column; align-items:center;">
                            <div class="plate-top-bar" style="background:${topBarColor}; width:100%;"></div>
                            <span class="plate-emirate">${data.emirate}</span>
                        </div>
                        <span class="plate-number">${data.plateNumber}</span>
                        <span class="plate-code">${data.plateCode}</span>
                    </div>
                </div>
            </div>
            <div class="card-meta">
                <span>${data.currentUserName ? 'Assigned: ' + data.currentUserName : 'Unassigned'}</span>
            </div>
        </div>
        <div class="card-body" id="body-${id}">
            <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">Type</span><span class="detail-value">${data.type}</span></div>
                <div class="detail-item"><span class="detail-label">Owner</span><span class="detail-value">${data.ownerName}</span></div>
                <div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">VIN</span><span class="detail-value">${data.vin}</span></div>
                <div class="detail-item"><span class="detail-label">License Expiry</span><span class="detail-value ${licClass}">${data.licenseExpiry.toDate().toLocaleDateString('en-GB')} (${licDiff}d)</span></div>
                <div class="detail-item"><span class="detail-label">Insurance Expiry</span><span class="detail-value ${insClass}">${data.insuranceExpiry.toDate().toLocaleDateString('en-GB')} (${insDiff}d)</span></div>
                <div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">Notes</span><span class="detail-value">${data.notes || 'N/A'}</span></div>
            </div>
            <div style="margin-top: 15px;">${actionsHtml}</div>
        </div>
    `;
    listContainer.appendChild(card);

    document.getElementById(`header-${id}`).addEventListener('click', () => card.classList.toggle('open'));

    if (!isUserView) {
        document.getElementById(`car-action-${id}`).addEventListener('change', (e) => {
            handleCarAction(id, e.target.value, data);
            e.target.value = "";
        });
    }
}

async function handleCarAction(id, action, data) {
    if (!action) return;
    if (action === 'edit') { showMessage('Edit Car form will be implemented soon.', 'warning', 'dashboard'); }
    else if (action === 'print') { showMessage('Generating PDF...', 'success', 'dashboard'); }
    else if (action === 'history') { showMessage('Car history log will be implemented soon.', 'warning', 'dashboard'); }
    else if (action === 'assign') { await renderAssignUserUI(id); }
    else if (action === 'unassign') { await handleUnassignUser(id, data); }
}

async function renderAssignUserUI(carId) {
    const assignArea = document.getElementById(`assign-area-${carId}`);
    assignArea.style.display = 'block';
    assignArea.innerHTML = '<p class="loading-text">Loading users...</p>';

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

        document.getElementById(`confirm-assign-${carId}`).addEventListener('click', async () => {
            const userId = document.getElementById(`select-user-${carId}`).value;
            if (!userId) return showMessage('Please select a user first.', 'warning', 'dashboard');
            
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                const userName = userDoc.data().username;

                await updateDoc(doc(db, 'cars', carId), { currentUserId: userId, currentUserName: userName });
                
                // Create assignment sub-collection record
                await addDoc(collection(db, 'cars', carId, 'assignments'), {
                    userId, userName, startTime: serverTimestamp(), endTime: null
                });

                await logAction(currentUserData, 'CAR_ASSIGN', { targetId: carId, targetName: userName, text: `Assigned car ${carId} to ${userName}` });
                showMessage('User assigned successfully.', 'success', 'dashboard');
                fetchCars(false);
            } catch (err) { showMessage(`Error: ${err.message}`, 'error', 'dashboard'); }
        });
    } catch (err) { assignArea.innerHTML = `<p class="error">Error: ${err.message}</p>`; }
}

async function handleUnassignUser(carId, data) {
    if (!data.currentUserId) return;
    try {
        await updateDoc(doc(db, 'cars', carId), { currentUserId: null, currentUserName: null });
        
        // Close the latest assignment record
        const q = query(collection(db, 'cars', carId, 'assignments'), where('userId', '==', data.currentUserId), where('endTime', '==', null), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
            await updateDoc(doc(db, 'cars', carId, 'assignments', snap.docs[0].id), { endTime: serverTimestamp() });
        }

        await logAction(currentUserData, 'CAR_UNASSIGN', { targetId: carId, targetName: data.currentUserName, text: `Unassigned car ${carId} from ${data.currentUserName}` });
        showMessage('User unassigned successfully.', 'success', 'dashboard');
        fetchCars(false);
    } catch (err) { showMessage(`Error: ${err.message}`, 'error', 'dashboard'); }
}

function showMessage(text, type, target = 'auth') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (box) { box.textContent = text; box.className = `message-box ${type}`; }
}