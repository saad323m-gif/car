/**
 * Main Application Entry - Car Management System
 * English only | Latin digits only | Production-ready
 */

// ===== دوال عرض الحالة =====
function setStatus(main, detail = '') {
    const mainEl = document.getElementById('status-message');
    const detailEl = document.getElementById('progress-details');
    if (mainEl) mainEl.textContent = main;
    if (detailEl) detailEl.textContent = detail;
    console.log(`Status: ${main} - ${detail}`);
}

function showErrorOnScreen(text) {
    const mainEl = document.getElementById('status-message');
    if (mainEl) {
        mainEl.style.color = '#d32f2f';
        mainEl.textContent = '❌ ' + text;
    }
    const detailEl = document.getElementById('progress-details');
    if (detailEl) detailEl.textContent = 'Check file names and paths.';
    console.error(text);
}

setStatus('Starting app...', '');

// ===== تحميل Firebase مع رسائل =====
setStatus('Loading Firebase...', '');
try {
    const firebaseModule = await import('./firebase.js');
    const { auth, db } = firebaseModule;
    if (!auth) throw new Error('auth is undefined');
    if (!db) throw new Error('db is undefined');
    setStatus('Firebase loaded.', 'Auth and Firestore ready.');
    window.auth = auth;
    window.db = db;
} catch (error) {
    showErrorOnScreen(`Firebase load error: ${error.message}`);
    throw error;
}

// استيراد دوال Firebase الضرورية (هذه لا تحتاج لملفات محلية)
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, browserLocalPersistence, browserSessionPersistence,
    updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, limit,
    serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

setStatus('Firebase SDK functions imported.', '');

// ===== تحميل الوحدات المحلية ديناميكياً =====
let renderDashboard, setCurrentUser, getCurrentUser;
let renderLogsView, logAction, setLogsCurrentUser;
let renderCarsView, setCarsCurrentUser;
let renderRequestsView, setRequestsCurrentUser;
let renderSearchView, setSearchCurrentUser;
let renderStatsView, setStatsCurrentUser;
let showDashboardMessage, showAuthMessage;
let handleFirebaseError;

async function loadModule(moduleName, filePath) {
    setStatus(`Loading ${moduleName}...`, `Path: ${filePath}`);
    try {
        const module = await import(filePath);
        setStatus(`${moduleName} loaded.`, '');
        return module;
    } catch (error) {
        showErrorOnScreen(`Failed to load ${moduleName}: ${error.message}`);
        throw error;
    }
}

try {
    const utils = await loadModule('utils', './utils.js');
    handleFirebaseError = utils.handleFirebaseError;

    const msg = await loadModule('messageManager', './messageManager.js');
    showDashboardMessage = msg.showDashboardMessage;
    showAuthMessage = msg.showAuthMessage;

    const members = await loadModule('members', './members.js');
    renderDashboard = members.renderDashboard;
    setCurrentUser = members.setCurrentUser;
    getCurrentUser = members.getCurrentUser;

    const logs = await loadModule('logs', './logs.js');
    renderLogsView = logs.renderLogsView;
    logAction = logs.logAction;
    setLogsCurrentUser = logs.setLogsCurrentUser;

    const cars = await loadModule('cars', './cars.js');
    renderCarsView = cars.renderCarsView;
    setCarsCurrentUser = cars.setCarsCurrentUser;

    const requests = await loadModule('requests', './requests.js');
    renderRequestsView = requests.renderRequestsView;
    setRequestsCurrentUser = requests.setRequestsCurrentUser;

    const search = await loadModule('search', './search.js');
    renderSearchView = search.renderSearchView;
    setSearchCurrentUser = search.setSearchCurrentUser;

    const stats = await loadModule('stats', './stats.js');
    renderStatsView = stats.renderStatsView;
    setStatsCurrentUser = stats.setStatsCurrentUser;

    setStatus('All modules loaded.', '');
} catch (error) {
    // سيتم عرضه بالفعل في showErrorOnScreen داخل loadModule
    console.error('Module loading error:', error);
}

// ===== المتغيرات العامة =====
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
let currentActiveTab = 'cars';

function emailToDocId(email) {
    return String(email || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
}

async function getLoginAttemptDoc(email) {
    const id = emailToDocId(email);
    if (!id) return null;
    const ref = doc(db, 'loginAttempts', id);
    const snap = await getDoc(ref);
    return snap.exists() ? { ref, data: snap.data() } : { ref, data: null };
}

async function isLoginLocked(email) {
    const result = await getLoginAttemptDoc(email);
    if (!result || !result.data || !result.data.lockedUntil) return { locked: false, remainingMs: 0 };
    const lockedUntil = result.data.lockedUntil.toDate ? result.data.lockedUntil.toDate() : new Date(result.data.lockedUntil);
    const now = new Date();
    if (lockedUntil > now) return { locked: true, remainingMs: lockedUntil - now };
    return { locked: false, remainingMs: 0 };
}

async function recordFailedLogin(email) {
    const result = await getLoginAttemptDoc(email);
    if (!result) return;
    const prev = result.data || {};
    let failCount = (prev.failCount || 0) + 1;
    let lockedUntil = null;
    if (prev.lockedUntil) {
        const prevLock = prev.lockedUntil.toDate ? prev.lockedUntil.toDate() : new Date(prev.lockedUntil);
        if (prevLock <= new Date()) failCount = 1;
    }
    if (failCount >= MAX_LOGIN_ATTEMPTS) {
        lockedUntil = Timestamp.fromDate(new Date(Date.now() + LOCK_DURATION_MS));
        failCount = MAX_LOGIN_ATTEMPTS;
    }
    await setDoc(result.ref, {
        email: String(email || '').trim().toLowerCase(),
        failCount,
        lockedUntil,
        updatedAt: serverTimestamp()
    }, { merge: true });
    return { failCount, locked: !!lockedUntil };
}

async function clearLoginAttempts(email) {
    const result = await getLoginAttemptDoc(email);
    if (!result) return;
    await setDoc(result.ref, {
        email: String(email || '').trim().toLowerCase(),
        failCount: 0,
        lockedUntil: null,
        updatedAt: serverTimestamp()
    }, { merge: true });
}

function formatRemainingLock(ms) {
    const mins = Math.ceil(ms / 60000);
    return mins <= 1 ? '1 minute' : `${mins} minutes`;
}

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
    const el = document.getElementById('datetime');
    if (el) el.textContent = now.toLocaleString('en-GB', options).replace(',', ' -');
}

// ===== أحداث DOM =====
window.addEventListener('DOMContentLoaded', () => {
    setStatus('DOM ready.', '');
    updateDateTime();
    setInterval(updateDateTime, 1000);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', renderChangePasswordForm);

    const headerLogo = document.getElementById('header-logo');
    if (headerLogo) {
        headerLogo.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const carsTab = document.querySelector('.tab-btn[data-tab="cars"]');
            if (carsTab) { carsTab.classList.add('active'); carsTab.click(); }
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled || btn.style.display === 'none') return;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            currentActiveTab = tab;
            if (tab === 'members' && renderDashboard) renderDashboard();
            else if (tab === 'logs' && renderLogsView) renderLogsView();
            else if (tab === 'cars' && renderCarsView) renderCarsView();
            else if (tab === 'requests' && renderRequestsView) renderRequestsView();
            else if (tab === 'search' && renderSearchView) renderSearchView();
            else if (tab === 'stats' && renderStatsView) renderStatsView();
        });
    });

    // ===== الجزء الحاسم: مستمع Auth مع تجاوز قسري =====
    setStatus('Setting auth listener...', 'Waiting for Firebase Auth...');

    let authTriggered = false;

    // مهلة 5 ثوانٍ لتجاوز المستمع
    const forceTimeout = setTimeout(() => {
        if (!authTriggered) {
            setStatus('Auth timeout. Forcing fallback.', 'Continuing without auth...');
            console.warn('onAuthStateChanged did not trigger. Falling back.');
            // تنفيذ المنطق الافتراضي (المستخدم غير مسجل)
            if (setCurrentUser) setCurrentUser(null);
            showAuthView();
            checkSystemState().catch(err => {
                showErrorOnScreen(`Fallback error: ${err.message}`);
            });
        }
    }, 5000);

    // محاولة تعيين المستمع
    try {
        onAuthStateChanged(auth, async (user) => {
            clearTimeout(forceTimeout);
            authTriggered = true;
            setStatus('Auth listener triggered.', user ? 'User logged in' : 'No user');

            try {
                if (user) {
                    setStatus('Checking user doc...', `UID: ${user.uid}`);
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        userData.uid = user.uid;
                        if (setCurrentUser) setCurrentUser(userData);
                        if (setCarsCurrentUser) setCarsCurrentUser(userData);
                        if (setRequestsCurrentUser) setRequestsCurrentUser(userData);
                        if (setLogsCurrentUser) setLogsCurrentUser(userData);
                        if (setSearchCurrentUser) setSearchCurrentUser(userData);
                        if (setStatsCurrentUser) setStatsCurrentUser(userData);

                        document.querySelectorAll('.tab-btn').forEach(tab => {
                            if (userData.role === 'admin' && userData.status === 'active') {
                                tab.style.display = 'block';
                                tab.disabled = false;
                            } else {
                                if (tab.dataset.tab === 'cars') {
                                    tab.style.display = 'block';
                                    tab.disabled = false;
                                } else {
                                    tab.style.display = 'none';
                                    tab.disabled = true;
                                }
                            }
                        });

                        setStatus('User authenticated.', 'Loading dashboard...');
                        showDashboard();
                    } else {
                        setStatus('User doc missing.', 'Signing out...');
                        await signOut(auth);
                        showAuthView();
                        await checkSystemState();
                    }
                } else {
                    setStatus('No user.', 'Checking system state...');
                    if (setCurrentUser) setCurrentUser(null);
                    showAuthView();
                    await checkSystemState();
                }
            } catch (error) {
                showErrorOnScreen(`Auth handler error: ${error.message}`);
                console.error(error);
            }
        });
    } catch (error) {
        clearTimeout(forceTimeout);
        showErrorOnScreen(`onAuthStateChanged error: ${error.message}`);
        console.error(error);
        // حتى لو فشل تعيين المستمع، ننفذ الفل باك
        if (!authTriggered) {
            setStatus('Auth listener setup failed.', 'Forcing fallback...');
            if (setCurrentUser) setCurrentUser(null);
            showAuthView();
            checkSystemState().catch(err => {
                showErrorOnScreen(`Fallback error: ${err.message}`);
            });
        }
    }
});

// ===== وظائف الواجهة =====
function showAuthView() {
    const authView = document.getElementById('auth-view');
    const dashView = document.getElementById('dashboard-view');
    const logoutBtn = document.getElementById('logout-btn');
    const changePassBtn = document.getElementById('change-password-btn');
    const headerLogo = document.getElementById('header-logo');
    const mainLogo = document.getElementById('main-logo');
    if (authView) authView.style.display = 'flex';
    if (dashView) dashView.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (changePassBtn) changePassBtn.style.display = 'none';
    if (headerLogo) headerLogo.style.display = 'none';
    if (mainLogo) mainLogo.style.display = 'block';
    setStatus('Auth view ready.', '');
}

function showDashboard() {
    const authView = document.getElementById('auth-view');
    const dashView = document.getElementById('dashboard-view');
    const logoutBtn = document.getElementById('logout-btn');
    const changePassBtn = document.getElementById('change-password-btn');
    const headerLogo = document.getElementById('header-logo');
    const mainLogo = document.getElementById('main-logo');
    if (authView) authView.style.display = 'none';
    if (dashView) dashView.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'block';
    if (changePassBtn) changePassBtn.style.display = 'block';
    if (headerLogo) headerLogo.style.display = 'block';
    if (mainLogo) mainLogo.style.display = 'none';

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const targetTab = document.querySelector(`.tab-btn[data-tab="${currentActiveTab}"]`) || document.querySelector('.tab-btn[data-tab="cars"]');
    if (targetTab) { targetTab.classList.add('active'); targetTab.click(); }
    setStatus('Dashboard ready.', '');
}

async function checkSystemState() {
    setStatus('Checking system state...', '');
    try {
        const q = query(collection(db, 'users'), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            setStatus('No users.', 'Showing setup...');
            renderSetupForm();
        } else {
            setStatus('Users found.', 'Showing login...');
            renderLoginForm();
        }
    } catch (error) {
        showErrorOnScreen(`System check error: ${error.message}`);
    }
}

function renderSetupForm() {
    document.getElementById('form-container').innerHTML = `
        <h2>System Setup</h2>
        <p style="margin-bottom: 20px; font-size: 0.9rem; color: #666; text-align:center;">
            Create the protected Super Admin account.
        </p>
        <form id="setup-form">
            <div class="form-group"><label>Username</label><input type="text" id="username" required></div>
            <div class="form-group"><label>Email</label><input type="email" id="email" required></div>
            <div class="form-group"><label>Password</label><input type="password" id="password" required minlength="6"></div>
            <div class="form-group"><label>Phone (Starts with 0, 10 digits)</label><input type="text" id="phone" required pattern="0\\d{9}" placeholder="0XXXXXXXXX"></div>
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

    if (!/^0\d{9}$/.test(phone)) {
        if (showAuthMessage) showAuthMessage('Error: Phone must start with 0 and be exactly 10 digits.');
        else alert('Error: Phone must start with 0 and be exactly 10 digits.');
        return;
    }
    if (!/^\d{4}$/.test(securityPin)) {
        if (showAuthMessage) showAuthMessage('Error: Security PIN must be exactly 4 digits.');
        else alert('Error: Security PIN must be exactly 4 digits.');
        return;
    }

    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnapshot = await getDocs(q);
        if (!usernameSnapshot.empty) {
            if (showAuthMessage) showAuthMessage('Error: Username already exists.');
            else alert('Error: Username already exists.');
            return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        await setDoc(doc(db, 'users', uid), {
            username, email, phone, role: 'admin', status: 'active',
            notes: '', isProtected: true, securityPin, rememberSession: false
        });
        if (logAction) await logAction({ uid, username }, 'SYSTEM_SETUP', { text: 'System initialized with Super Admin' });
        if (showAuthMessage) showAuthMessage('Success: Super Admin created successfully.', 'success');
        else alert('Success: Super Admin created successfully.');
    } catch (error) {
        if (handleFirebaseError) handleFirebaseError(error);
        else alert('Error: ' + error.message);
    }
}

function renderLoginForm() {
    document.getElementById('form-container').innerHTML = `
        <h2>Login</h2>
        <form id="login-form">
            <div class="form-group"><label>Email</label><input type="email" id="login-email" required></div>
            <div class="form-group"><label>Password</label><input type="password" id="login-password" required></div>
            <div class="form-group checkbox-group">
                <input type="checkbox" id="remember-me">
                <label for="remember-me" style="margin-bottom:0">Remember Me</label>
            </div>
            <button type="submit" class="btn">Login</button>
        </form>
    `;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
    e.preventDefault();
    const emailEl = document.getElementById('login-email');
    const passwordEl = document.getElementById('login-password');
    const rememberEl = document.getElementById('remember-me');
    if (!emailEl || !passwordEl) return;

    const email = emailEl.value.trim();
    const password = passwordEl.value;
    const rememberMe = rememberEl ? rememberEl.checked : false;

    if (!email || !password) {
        if (showAuthMessage) showAuthMessage('Error: Email and password are required.');
        else alert('Error: Email and password are required.');
        return;
    }

    try {
        const lockStatus = await isLoginLocked(email);
        if (lockStatus.locked) {
            const msg = `Too many failed attempts. Try again after ${formatRemainingLock(lockStatus.remainingMs)}.`;
            if (showAuthMessage) showAuthMessage(msg);
            else alert(msg);
            if (logAction) await logAction({ username: email }, 'LOGIN_FAILED', { text: `Locked account login attempt for ${email}` });
            return;
        }

        await auth.setPersistence(rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            if (showAuthMessage) showAuthMessage('Error: User data not found.');
            else alert('Error: User data not found.');
            await signOut(auth);
            return;
        }
        const userData = userDoc.data();
        if (userData.status === 'suspended') {
            await signOut(auth);
            if (logAction) await logAction({ username: email }, 'LOGIN_FAILED', { text: `Suspended account attempt: ${email}` });
            if (showAuthMessage) showAuthMessage('Access Denied: Your account is suspended.');
            else alert('Access Denied: Your account is suspended.');
            return;
        }

        await clearLoginAttempts(email);
        await updateDoc(doc(db, 'users', uid), { rememberSession: rememberMe });
        if (logAction) await logAction(userData, 'LOGIN', { text: 'User logged in' });
    } catch (error) {
        let failInfo = null;
        try { failInfo = await recordFailedLogin(email); } catch (_) {}
        if (logAction) await logAction({ username: email }, 'LOGIN_FAILED', { text: `Failed login attempt for ${email}` });
        if (failInfo && failInfo.locked) {
            if (showAuthMessage) showAuthMessage(`Too many failed attempts. Account locked for 15 minutes.`);
            else alert(`Too many failed attempts. Account locked for 15 minutes.`);
        } else if (failInfo && failInfo.failCount) {
            const left = MAX_LOGIN_ATTEMPTS - failInfo.failCount;
            if (handleFirebaseError) handleFirebaseError(error);
            else alert('Login failed: ' + error.message);
            if (left > 0 && showAuthMessage) showAuthMessage(`Login failed. ${left} attempt${left === 1 ? '' : 's'} remaining before lock.`, 'warning');
        } else {
            if (handleFirebaseError) handleFirebaseError(error);
            else alert('Login failed: ' + error.message);
        }
    }
}

async function handleLogout() {
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists() && logAction) await logAction(userDoc.data(), 'LOGOUT', { text: 'User logged out' });
        }
        await signOut(auth);
        showAuthView();
        await checkSystemState();
    } catch (error) {
        if (handleFirebaseError) handleFirebaseError(error);
        else alert('Logout error: ' + error.message);
    }
}

function renderChangePasswordForm() {
    if (!getCurrentUser) {
        if (showDashboardMessage) showDashboardMessage('Error: User data not available.', 'error');
        else alert('Error: User data not available.');
        return;
    }
    const userData = getCurrentUser();
    if (!userData || !auth.currentUser) {
        if (showDashboardMessage) showDashboardMessage('You must be logged in to change password.', 'error');
        else alert('You must be logged in to change password.');
        return;
    }
    const container = document.getElementById('dashboard-container');
    if (!container) return;
    container.innerHTML = `
        <h2>Change Password</h2>
        <p style="color:#666; margin-bottom:20px; text-align:center;">
            Enter your current password, then choose a new one.
        </p>
        <form id="change-password-form" style="max-width:500px; margin:0 auto;">
            <div class="form-group"><label>Current Password</label><input type="password" id="cp-current" required minlength="6" autocomplete="current-password"></div>
            <div class="form-group"><label>New Password</label><input type="password" id="cp-new" required minlength="6" autocomplete="new-password"></div>
            <div class="form-group"><label>Confirm New Password</label><input type="password" id="cp-confirm" required minlength="6" autocomplete="new-password"></div>
            <button type="submit" class="btn" id="cp-submit">Update Password</button>
            <button type="button" class="btn btn-secondary" id="cp-cancel" style="margin-top:10px;">Cancel</button>
        </form>
    `;
    const form = document.getElementById('change-password-form');
    const cancelBtn = document.getElementById('cp-cancel');
    if (form) form.addEventListener('submit', handleChangePassword);
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const targetTab = document.querySelector(`.tab-btn[data-tab="${currentActiveTab}"]`);
            if (targetTab) { targetTab.classList.add('active'); targetTab.click(); }
            else { const carsTab = document.querySelector('.tab-btn[data-tab="cars"]'); if (carsTab) { carsTab.classList.add('active'); carsTab.click(); } }
        });
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
    if (!getCurrentUser) {
        if (showDashboardMessage) showDashboardMessage('Error: User data not available.', 'error');
        else alert('Error: User data not available.');
        return;
    }
    const userData = getCurrentUser();
    if (!userData || !auth.currentUser) return;
    const currentEl = document.getElementById('cp-current');
    const newEl = document.getElementById('cp-new');
    const confirmEl = document.getElementById('cp-confirm');
    const submitBtn = document.getElementById('cp-submit');
    if (!currentEl || !newEl || !confirmEl) return;

    const currentPassword = currentEl.value;
    const newPassword = newEl.value;
    const confirmPassword = confirmEl.value;

    if (newPassword.length < 6) {
        if (showDashboardMessage) showDashboardMessage('Error: New password must be at least 6 characters.', 'error');
        else alert('Error: New password must be at least 6 characters.');
        return;
    }
    if (newPassword !== confirmPassword) {
        if (showDashboardMessage) showDashboardMessage('Error: New password and confirmation do not match.', 'error');
        else alert('Error: New password and confirmation do not match.');
        return;
    }
    if (currentPassword === newPassword) {
        if (showDashboardMessage) showDashboardMessage('Error: New password must be different from the current password.', 'error');
        else alert('Error: New password must be different from the current password.');
        return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Updating...'; }

    try {
        const credential = EmailAuthProvider.credential(userData.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        if (logAction) await logAction(userData, 'CHANGE_PASSWORD', {
            targetId: userData.uid,
            targetName: userData.username,
            text: `Password changed by ${userData.username}`
        });
        if (showDashboardMessage) showDashboardMessage('Password updated successfully.', 'success');
        else alert('Password updated successfully.');
        currentEl.value = ''; newEl.value = ''; confirmEl.value = '';
        setTimeout(() => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const targetTab = document.querySelector(`.tab-btn[data-tab="${currentActiveTab}"]`);
            if (targetTab) { targetTab.classList.add('active'); targetTab.click(); }
            else { const carsTab = document.querySelector('.tab-btn[data-tab="cars"]'); if (carsTab) { carsTab.classList.add('active'); carsTab.click(); } }
        }, 1500);
    } catch (error) {
        if (handleFirebaseError) handleFirebaseError(error);
        else alert('Password change error: ' + error.message);
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Update Password'; }
    }
}

setStatus('App initialization complete.', 'Waiting for auth...');
console.log('app.js execution completed.');