import { auth, db } from "./firebase.js";
import { 
    createUserWithEmailAndPassword, signInWithEmailAndPassword, 
    signOut, onAuthStateChanged, browserLocalPersistence, browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { renderDashboard, setCurrentUser } from "./members.js";
import { renderLogsView, logAction, setLogsCurrentUser } from "./logs.js";
import { renderCarsView, setCarsCurrentUser } from "./cars.js";
import { renderRequestsView, setRequestsCurrentUser } from "./requests.js";
import { renderSearchView, setSearchCurrentUser } from "./search.js";
import { renderStatsView, setStatsCurrentUser } from "./stats.js";

function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true, timeZone: 'Asia/Dubai'
    };
    document.getElementById('datetime').textContent = now.toLocaleString('en-GB', options).replace(',', ' -');
}

window.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled || btn.style.display === 'none') return;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tab = btn.dataset.tab;
            if (tab === 'members') renderDashboard();
            else if (tab === 'logs') renderLogsView();
            else if (tab === 'cars') renderCarsView();
            else if (tab === 'requests') renderRequestsView();
            else if (tab === 'search') renderSearchView();
            else if (tab === 'stats') renderStatsView();
        });
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                let userData = userDoc.data();
                userData.uid = user.uid;
                
                // Sync user data to all modules for Security Guards
                setCurrentUser(userData);
                setCarsCurrentUser(userData);
                setRequestsCurrentUser(userData);
                setLogsCurrentUser(userData);
                setSearchCurrentUser(userData);
                setStatsCurrentUser(userData);
                
                // UI Obfuscation (Layer 3)
                document.querySelectorAll('.tab-btn').forEach(tab => {
                    if (userData.role === 'admin') {
                        tab.style.display = 'block';
                    } else {
                        tab.style.display = tab.dataset.tab === 'cars' ? 'block' : 'none';
                    }
                });
                
                showDashboard();
            } else {
                await signOut(auth);
                showAuthView();
            }
        } else {
            setCurrentUser(null);
            showAuthView();
            await checkSystemState();
        }
    });
});

function showAuthView() {
    document.getElementById('auth-view').style.display = 'flex';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('logout-btn').style.display = 'none';
    document.getElementById('header-logo').style.display = 'none';
    document.getElementById('main-logo').style.display = 'block';
}

function showDashboard() {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'flex';
    document.getElementById('logout-btn').style.display = 'block';
    document.getElementById('header-logo').style.display = 'block';
    document.getElementById('main-logo').style.display = 'none';
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="cars"]').classList.add('active');
    renderCarsView();
}

async function checkSystemState() {
    const formContainer = document.getElementById('form-container');
    try {
        const q = query(collection(db, 'users'), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) { renderSetupForm(); } else { renderLoginForm(); }
    } catch (error) { showMessage(`System Error: ${error.message}`, 'error'); }
}

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
            username, email, phone, role: 'admin', status: 'active', notes: '',
            isProtected: true, securityPin, rememberSession: false
        });
        
        await logAction({uid, username}, 'SYSTEM_SETUP', { text: 'System initialized with Super Admin' });
        showMessage('Success: Super Admin created successfully.', 'success');
    } catch (error) { handleFirebaseError(error); }
}

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
        if (!userDoc.exists()) { showMessage('Error: User data not found.', 'error'); return; }

        const userData = userDoc.data();
        if (userData.status === 'suspended') {
            await signOut(auth);
            await logAction({username: email}, 'LOGIN_FAILED', { text: `Suspended account attempt: ${email}` });
            showMessage('Access Denied: Your account is suspended.', 'error');
            return;
        }

        await updateDoc(doc(db, 'users', uid), { rememberSession: rememberMe });
        await logAction(userData, 'LOGIN', { text: `User logged in` });
    } catch (error) {
        await logAction({username: email}, 'LOGIN_FAILED', { text: `Failed login attempt for ${email}` });
        handleFirebaseError(error);
    }
}

async function handleLogout() {
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) { await logAction(userDoc.data(), 'LOGOUT', { text: 'User logged out' }); }
        }
        await signOut(auth);
        showAuthView();
        await checkSystemState();
    } catch (error) { handleFirebaseError(error); }
}

function handleFirebaseError(error) {
    let message = '';
    switch (error.code) {
        case 'auth/invalid-email': message = 'Error: The email address is badly formatted.'; break;
        case 'auth/user-disabled': message = 'Error: This user has been disabled.'; break;
        case 'auth/user-not-found': message = 'Error: No user found with this email.'; break;
        case 'auth/wrong-password': message = 'Error: Incorrect password. Please try again.'; break;
        case 'auth/email-already-in-use': message = 'Error: The email is already in use.'; break;
        case 'auth/weak-password': message = 'Error: Password should be at least 6 characters.'; break;
        case 'auth/too-many-requests': message = 'Warning: Too many failed login attempts.'; break;
        case 'auth/network-request-failed': message = 'Error: Network error. Check connection.'; break;
        default: message = `System Error: ${error.message}`;
    }
    showMessage(message, 'error');
}

function showMessage(text, type) {
    const box = document.getElementById('message-box');
    if (box) { box.textContent = text; box.className = `message-box ${type}`; }
}