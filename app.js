import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged, browserLocalPersistence, browserSessionPersistence,
    reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, getDocs, 
    updateDoc, deleteDoc, query, where, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDBHHGY_gVpm3NlXThqsC6ojTL9Je4xQ9w",
    authDomain: "car-moving-8b59e.firebaseapp.com",
    databaseURL: "https://car-moving-8b59e-default-rtdb.firebaseio.com",
    projectId: "car-moving-8b59e",
    storageBucket: "car-moving-8b59e.firebasestorage.app",
    messagingSenderId: "332747318494",
    appId: "1:332747318494:web:d5d61cd53f322a182f0e4f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserData = null;

// Real-time UAE Date and Time
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Asia/Dubai'
    };
    document.getElementById('datetime').textContent = now.toLocaleString('en-GB', options).replace(',', ' -');
}

// Initial Load
window.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 1000);

    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                currentUserData = userDoc.data();
                currentUserData.uid = user.uid;
                showDashboard();
            } else {
                await signOut(auth);
                showAuthView();
            }
        } else {
            currentUserData = null;
            showAuthView();
            await checkSystemState();
        }
    });
});

function showAuthView() {
    document.getElementById('auth-view').style.display = 'flex';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
}

function showDashboard() {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
    document.getElementById('logout-btn').style.display = 'block';
    
    renderDashboard();
}

// Check if Super Admin exists
async function checkSystemState() {
    const formContainer = document.getElementById('form-container');
    try {
        const q = query(collection(db, 'users'), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            renderSetupForm();
        } else {
            renderLoginForm();
        }
    } catch (error) {
        showMessage(`System Error: ${error.message}`, 'error');
    }
}

// --- SETUP SUPER ADMIN ---
function renderSetupForm() {
    document.getElementById('form-container').innerHTML = `
        <h2>System Setup</h2>
        <p style="margin-bottom: 20px; font-size: 0.9rem; color: #666; text-align:center;">Create the protected Super Admin account.</p>
        <form id="setup-form">
            <div class="form-group"><label>Username</label><input type="text" id="username" required></div>
            <div class="form-group"><label>Email</label><input type="email" id="email" required></div>
            <div class="form-group"><label>Password</label><input type="password" id="password" required minlength="6"></div>
            <div class="form-group"><label>Phone (Starts with 0, 10 digits)</label><input type="text" id="phone" required pattern="0\\d{9}"></div>
            <div class="form-group"><label>Security PIN (4 digits)</label><input type="password" id="securityPin" required pattern="\\d{4}"></div>
            <button type="submit" class="btn">Create Super Admin</button>
        </form>
    `;
    document.getElementById('setup-form').addEventListener('submit', handleSetup);
}

async function handleSetup(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone').value.trim();
    const securityPin = document.getElementById('securityPin').value;

    if (!/^0\d{9}$/.test(phone)) return showMessage('Error: Phone must start with 0 and be exactly 10 digits.', 'error');
    if (!/^\d{4}$/.test(securityPin)) return showMessage('Error: Security PIN must be exactly 4 digits.', 'error');

    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnapshot = await getDocs(q);
        if (!usernameSnapshot.empty) return showMessage('Error: Username already exists.', 'error');

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, 'users', uid), {
            username, email, phone,
            role: 'admin', status: 'active', notes: '',
            isProtected: true, securityPin, rememberSession: false
        });

        showMessage('Success: Super Admin created successfully.', 'success');
    } catch (error) {
        handleFirebaseError(error);
    }
}

// --- LOGIN ---
function renderLoginForm() {
    document.getElementById('form-container').innerHTML = `
        <h2>Login</h2>
        <form id="login-form">
            <div class="form-group"><label>Email</label><input type="email" id="login-email" required></div>
            <div class="form-group"><label>Password</label><input type="password" id="login-password" required></div>
            <div class="form-group checkbox-group">
                <input type="checkbox" id="remember-me"><label for="remember-me" style="margin-bottom:0">Remember Me</label>
            </div>
            <button type="submit" class="btn">Login</button>
        </form>
    `;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    try {
        await auth.setPersistence(rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            showMessage('Error: User data not found.', 'error');
            return;
        }

        const userData = userDoc.data();
        if (userData.status === 'suspended') {
            await signOut(auth);
            showMessage('Access Denied: Your account is suspended.', 'error');
            return;
        }

        await updateDoc(doc(db, 'users', uid), { rememberSession: rememberMe });
        // onAuthStateChanged will handle the transition automatically
    } catch (error) {
        handleFirebaseError(error);
    }
}

async function handleLogout() {
    try {
        await signOut(auth);
        showAuthView();
        await checkSystemState();
    } catch (error) {
        handleFirebaseError(error);
    }
}

// --- DASHBOARD ---
function renderDashboard() {
    const container = document.getElementById('dashboard-container');
    
    if (currentUserData.role === 'admin') {
        container.innerHTML = `
            <h2>Admin Dashboard</h2>
            <p>Welcome, <strong>${currentUserData.username}</strong></p>
            <button class="btn btn-sm btn-warning" id="edit-profile-btn" style="margin: 15px 0;">Edit My Profile</button>
            
            <div class="divider"></div>
            
            <h3>Add New Member</h3>
            <form id="add-user-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px;">
                <div class="form-group"><label>Username</label><input type="text" id="new-username" required></div>
                <div class="form-group"><label>Email</label><input type="email" id="new-email" required></div>
                <div class="form-group"><label>Password</label><input type="password" id="new-password" required minlength="6"></div>
                <div class="form-group"><label>Phone</label><input type="text" id="new-phone" required pattern="0\\d{9}"></div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Role</label>
                    <select id="new-role">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div class="form-group" style="Grid-column: 1 / -1;">
                    <button type="submit" class="btn">Add Member</button>
                </div>
            </form>

            <div class="divider"></div>

            <h3>Members Management</h3>
            <div class="table-container">
                <table id="users-table">
                    <thead>
                        <tr>
                            <th>Username</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody"></tbody>
                </table>
            </div>
        `;

        document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
        document.getElementById('edit-profile-btn').addEventListener('click', renderEditProfileForm);
        
        fetchUsersForAdmin();
    } else {
        container.innerHTML = `
            <h2>User Dashboard</h2>
            <p>Welcome, <strong>${currentUserData.username}</strong></p>
            <p>Your account is active. User features will be available here in future phases.</p>
        `;
    }
}

async function handleAddUser(e) {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const phone = document.getElementById('new-phone').value.trim();
    const role = document.getElementById('new-role').value;

    if (!/^0\d{9}$/.test(phone)) return showDashboardMessage('Error: Phone must start with 0 and be 10 digits.', 'error');

    try {
        // Check Username uniqueness
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return showDashboardMessage('Error: Username already exists.', 'error');

        // Create User (Secondary App Instance to prevent logging out the admin)
        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, 'users', uid), {
            username, email, phone, role,
            status: 'active', notes: '',
            isProtected: false, securityPin: null, rememberSession: false
        });

        await secondaryAuth.signOut();
        showDashboardMessage('Success: Member added successfully.', 'success');
        document.getElementById('add-user-form').reset();

    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    }
}

function fetchUsersForAdmin() {
    const tbody = document.getElementById('users-tbody');
    const q = collection(db, 'users');
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        snapshot.forEach((d) => {
            const data = d.data();
            const uid = d.id;
            const tr = document.createElement('tr');
            
            let actions = '';
            if (!data.isProtected) {
                if (data.role === 'user') {
                    actions += `<button class="btn btn-sm btn-secondary" onclick="promoteUser('${uid}')">Promote</button>`;
                } else {
                    actions += `<button class="btn btn-sm btn-secondary" onclick="demoteUser('${uid}')">Demote</button>`;
                }
                
                if (data.status === 'active') {
                    actions += `<button class="btn btn-sm btn-warning" onclick="toggleSuspend('${uid}', 'suspended')">Suspend</button>`;
                } else {
                    actions += `<button class="btn btn-sm btn-success" onclick="toggleSuspend('${uid}', 'active')">Activate</button>`;
                }
                actions += `<button class="btn btn-sm btn-danger" onclick="deleteUser('${uid}')">Delete</button>`;
            } else {
                actions = `<span style="color:#1976d2; font-weight:bold;">Protected</span>`;
            }

            tr.innerHTML = `
                <td>${data.username}</td>
                <td>${data.email}</td>
                <td>${data.phone}</td>
                <td class="role-${data.role}">${data.role}</td>
                <td class="status-${data.status}">${data.status}</td>
                <td class="action-group">${actions}</td>
            `;
            tbody.appendChild(tr);
        });
    });
}

window.promoteUser = async (uid) => {
    try {
        await updateDoc(doc(db, 'users', uid), { role: 'admin' });
        showDashboardMessage('User promoted successfully.', 'success');
    } catch (e) { handleFirebaseError(e, 'dashboard'); }
}

window.demoteUser = async (uid) => {
    try {
        await updateDoc(doc(db, 'users', uid), { role: 'user' });
        showDashboardMessage('User demoted successfully.', 'success');
    } catch (e) { handleFirebaseError(e, 'dashboard'); }
}

window.toggleSuspend = async (uid, status) => {
    try {
        await updateDoc(doc(db, 'users', uid), { status: status });
        showDashboardMessage(`User status changed to ${status}.`, 'success');
    } catch (e) { handleFirebaseError(e, 'dashboard'); }
}

window.deleteUser = async (uid) => {
    // Note: Auth user deletion requires Admin SDK (Cloud Functions). We will delete Firestore record to prevent access.
    if (!confirm("Are you sure you want to delete this user? (Note: Auth account needs to be deleted from Firebase Console manually for strict security)")) return;
    try {
        await deleteDoc(doc(db, 'users', uid));
        showDashboardMessage('User record deleted.', 'success');
    } catch (e) { handleFirebaseError(e, 'dashboard'); }
}

// --- SUPER ADMIN PROFILE PROTECTION ---
function renderEditProfileForm() {
    if (!currentUserData.isProtected) {
        showDashboardMessage("Only Super Admin can use this secure edit feature.", "warning");
        return;
    }

    document.getElementById('dashboard-container').innerHTML = `
        <h2>Edit Protected Profile</h2>
        <p style="color: #666; margin-bottom: 20px;">Two-step verification required.</p>
        <form id="edit-profile-form" style="max-width: 500px; margin: 0 auto;">
            <div class="form-group">
                <label>Current Password</label>
                <input type="password" id="verify-password" required>
            </div>
            <div class="form-group">
                <label>Security PIN (4 digits)</label>
                <input type="password" id="verify-pin" required pattern="\\d{4}">
            </div>
            <div class="divider"></div>
            <div class="form-group"><label>New Username</label><input type="text" id="edit-username" value="${currentUserData.username}" required></div>
            <div class="form-group"><label>New Phone</label><input type="text" id="edit-phone" value="${currentUserData.phone}" required pattern="0\\d{9}"></div>
            <button type="submit" class="btn">Verify & Update</button>
            <button type="button" class="btn btn-secondary" onclick="renderDashboard()" style="margin-top:10px;">Cancel</button>
        </form>
    `;

    document.getElementById('edit-profile-form').addEventListener('submit', handleEditProtectedProfile);
}

async function handleEditProtectedProfile(e) {
    e.preventDefault();
    const password = document.getElementById('verify-password').value;
    const pin = document.getElementById('verify-pin').value;
    const newUsername = document.getElementById('edit-username').value.trim();
    const newPhone = document.getElementById('edit-phone').value.trim();

    if (pin !== currentUserData.securityPin) {
        return showDashboardMessage('Security Error: Invalid Security PIN.', 'error');
    }

    if (!/^0\d{9}$/.test(newPhone)) {
        return showDashboardMessage('Error: Phone must start with 0 and be 10 digits.', 'error');
    }

    try {
        // Re-authenticate user with Firebase Auth
        const credential = EmailAuthProvider.credential(currentUserData.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);

        // Check Username uniqueness if changed
        if (newUsername !== currentUserData.username) {
            const q = query(collection(db, 'users'), where('username', '==', newUsername));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) return showDashboardMessage('Error: Username already exists.', 'error');
        }

        // Update Firestore
        await updateDoc(doc(db, 'users', currentUserData.uid), {
            username: newUsername,
            phone: newPhone
        });

        showDashboardMessage('Profile updated successfully. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 2000);

    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    }
}

// --- ERROR HANDLING ---
function handleFirebaseError(error, target = 'auth') {
    let message = '';
    switch (error.code) {
        case 'auth/invalid-email': message = 'Error: The email address is badly formatted.'; break;
        case 'auth/user-disabled': message = 'Error: This user has been disabled.'; break;
        case 'auth/user-not-found': message = 'Error: No user found with this email.'; break;
        case 'auth/wrong-password': message = 'Error: Incorrect password. Please try again.'; break;
        case 'auth/email-already-in-use': message = 'Error: The email is already in use by another account.'; break;
        case 'auth/weak-password': message = 'Error: Password should be at least 6 characters.'; break;
        case 'auth/too-many-requests': message = 'Warning: Too many failed login attempts. Try again later.'; break;
        case 'auth/network-request-failed': message = 'Error: Network error. Check your internet connection.'; break;
        case 'auth/requires-recent-login': message = 'Error: Please logout and login again before updating your profile.'; break;
        default: message = `System Error: ${error.message}`;
    }
    showMessage(message, 'error', target);
}

function showMessage(text, type, target = 'auth') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (box) {
        box.textContent = text;
        box.className = `message-box ${type}`;
    }
}

function showDashboardMessage(text, type) {
    showMessage(text, type, 'dashboard');
}