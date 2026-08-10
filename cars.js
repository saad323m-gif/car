import { db } from "./firebase.js";
import { 
    collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
    query, where, limit, startAfter, orderBy, runTransaction 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";

let currentUserData = null;
let lastVisibleCar = null;

export const setCarsCurrentUser = (data) => currentUserData = data;

// Render Cars View
export function renderCarsView() {
    const container = document.getElementById('dashboard-container');
    
    if (currentUserData.role === 'admin') {
        container.innerHTML = `
            <h2>Cars Management</h2>
            <div class="divider"></div>
            <h3>Add New Car</h3>
            <form id="add-car-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px;">
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
                <div class="form-group" style="Grid-column: 1 / -1;">
                    <button type="submit" class="btn">Add Car</button>
                </div>
            </form>

            <div class="divider"></div>

            <h3>Cars List</h3>
            <div id="cars-card-list" class="card-list">
                <p class="loading-text">Loading cars...</p>
            </div>
            <div id="load-more-container" class="load-more-container"></div>
        `;
        document.getElementById('add-car-form').addEventListener('submit', handleAddCar);
        lastVisibleCar = null;
        fetchCars(false);
    } else {
        container.innerHTML = `
            <h2>My Assigned Cars</h2>
            <p style="text-align:center; color:#666;">You can view cars currently assigned to you here.</p>
            <div id="cars-card-list" class="card-list"></div>
        `;
        fetchUserCars();
    }
}

// Generate UAE-001 ID sequentially
async function generateCarId() {
    const counterRef = doc(db, 'counters', 'carId');
    try {
        const newCount = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            if (!counterDoc.exists()) {
                transaction.set(counterRef, { count: 1 });
                return 1;
            }
            const newCount = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: newCount });
            return newCount;
        });
        return `UAE-${newCount.toString().padStart(3, '0')}`;
    } catch (e) {
        console.error("Transaction failed: ", e);
        throw e;
    }
}

// Add Car Logic
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
        // Check Unique Plate
        const plateQ = query(collection(db, 'cars'), where('plateIdentifier', '==', plateIdentifier));
        const plateSnap = await getDocs(plateQ);
        if (!plateSnap.empty) return showMessage('Error: This Plate combination already exists.', 'error', 'dashboard');

        // Check Unique VIN
        const vinQ = query(collection(db, 'cars'), where('vin', '==', vin.toLowerCase()));
        const vinSnap = await getDocs(vinQ);
        if (!vinSnap.empty) return showMessage('Error: This VIN already exists.', 'error', 'dashboard');

        // Generate Car ID
        const carId = await generateCarId();

        // Save Car
        await setDoc(doc(db, 'cars', carId), {
            carId, plateNumber: plateNum, plateCode: plateCode, emirate,
            plateIdentifier, type, ownerName: owner, vin,
            licenseExpiry: new Date(licenseExp), insuranceExpiry: new Date(insuranceExp),
            notes, currentUserId: null, currentUserName: null, status: 'active'
        });

        await logAction(currentUserData, 'CREATE_CAR', { targetId: carId, targetName: plateNum, text: `Created car ${carId} (${plateNum})` });
        
        showMessage('Success: Car added successfully.', 'success', 'dashboard');
        document.getElementById('add-car-form').reset();
        lastVisibleCar = null;
        fetchCars(false);
    } catch (error) {
        showMessage(`System Error: ${error.message}`, 'error', 'dashboard');
    }
}

// Fetch Cars for Admin (Sorted by closest expiry)
async function fetchCars(loadMore = false) {
    const listContainer = document.getElementById('cars-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    
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
            loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleCar = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        snapshot.forEach((d) => {
            const data = d.data();
            renderCarCard(d.id, data);
        });

        if (snapshot.size === 10) {
            loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load More</button>';
            document.getElementById('load-more-btn').addEventListener('click', () => fetchCars(true));
        } else {
            loadMoreContainer.innerHTML = '';
        }
    } catch (error) {
        listContainer.innerHTML = `<p class="error">Error loading cars: ${error.message}</p>`;
    }
}

// Fetch Cars for Regular User
async function fetchUserCars() {
    const listContainer = document.getElementById('cars-card-list');
    listContainer.innerHTML = '<p class="loading-text">Loading your cars...</p>';
    try {
        const q = query(collection(db, 'cars'), where('currentUserId', '==', currentUserData.uid));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            listContainer.innerHTML = '<p style="text-align:center; color:#666;">No cars assigned to you currently.</p>';
            return;
        }
        listContainer.innerHTML = '';
        snapshot.forEach(d => renderCarCard(d.id, d.data(), true));
    } catch (error) {
        listContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

// Render Single Car Card with Plate UI & Color Logic
function renderCarCard(id, data, isUserView = false) {
    const listContainer = document.getElementById('cars-card-list');
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${id}`;

    // Expiry Color Logic
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const licDiff = Math.ceil((data.licenseExpiry.toDate() - today) / (1000 * 60 * 60 * 24));
    const insDiff = Math.ceil((data.insuranceExpiry.toDate() - today) / (1000 * 60 * 60 * 24));
    const minDiff = Math.min(licDiff, insDiff);

    if (minDiff < 0) card.classList.add('border-red');
    else if (minDiff <= 15) card.classList.add('border-yellow');

    // Emirate Color Mapping
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

    card.innerHTML = `
        <div class="card-header" id="header-${id}">
            <div class="card-title">
                <div class="plate-container">
                    <div style="display:flex; flex-direction:column; align-items:center;">
                        <div class="plate-top-bar" style="background:${topBarColor}; width:100%;"></div>
                        <span class="plate-emirate">${data.emirate}</span>
                    </div>
                    <span class="plate-number">${data.plateNumber}</span>
                    <span class="plate-code">${data.plateCode}</span>
                </div>
            </div>
            <div class="card-meta">
                <span>${data.carId}</span>
            </div>
        </div>
        <div class="card-body" id="body-${id}">
            <p><strong>Type:</strong> ${data.type}</p>
            <p><strong>Owner:</strong> ${data.ownerName}</p>
            <p><strong>VIN:</strong> ${data.vin}</p>
            <p><strong>License Expiry:</strong> ${data.licenseExpiry.toDate().toLocaleDateString('en-GB')} (${licDiff} days left)</p>
            <p><strong>Insurance Expiry:</strong> ${data.insuranceExpiry.toDate().toLocaleDateString('en-GB')} (${insDiff} days left)</p>
            <p><strong>Assigned To:</strong> ${data.currentUserName || 'Unassigned'}</p>
            <p><strong>Notes:</strong> ${data.notes || 'N/A'}</p>
            
            <div style="margin-top: 15px;">
                ${isUserView ? '' : `
                    <select class="action-select" id="car-action-${id}">
                        <option value="">Select Action</option>
                        <option value="edit">Edit Car</option>
                        <option value="assign">Assign User</option>
                        <option value="print">Print Card</option>
                        <option value="history">View History</option>
                    </select>
                `}
            </div>
        </div>
    `;
    listContainer.appendChild(card);

    document.getElementById(`header-${id}`).addEventListener('click', () => {
        card.classList.toggle('open');
    });

    if (!isUserView) {
        document.getElementById(`car-action-${id}`).addEventListener('change', (e) => {
            handleCarAction(id, e.target.value, data);
            e.target.value = "";
        });
    }
}

// Handle Car Actions
async function handleCarAction(id, action, data) {
    if (!action) return;
    if (action === 'edit') {
        showMessage('Edit Car form will be implemented in next refinement.', 'warning', 'dashboard');
    } else if (action === 'print') {
        showMessage('Generating PDF...', 'success', 'dashboard');
        // PDF Logic will go here
    } else if (action === 'assign') {
        showMessage('Assign User logic will be implemented in linking phase.', 'warning', 'dashboard');
    } else if (action === 'history') {
        showMessage('Car history log will be implemented in logs phase.', 'warning', 'dashboard');
    }
}

function showMessage(text, type, target = 'auth') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (box) {
        box.textContent = text;
        box.className = `message-box ${type}`;
    }
}