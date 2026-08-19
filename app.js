/**
 * Main Application Entry - Car Management System
 * English & Arabic support
 */

import { auth, db } from "./firebase.js";
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, browserLocalPersistence, browserSessionPersistence,
    updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, limit,
    serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { renderDashboard, setCurrentUser, getCurrentUser } from "./members.js";
import { renderLogsView, logAction, setLogsCurrentUser } from "./logs.js";
import { renderCarsView, setCarsCurrentUser } from "./cars.js";
import { renderRequestsView, setRequestsCurrentUser } from "./requests.js";
import { renderSearchView, setSearchCurrentUser } from "./search.js";
import { renderStatsView, setStatsCurrentUser } from "./stats.js";
import { 
    showMessage, handleFirebaseError, clearMessage,
    t, setLanguage, getLanguage, lockUI, unlockUI
} from "./utils.js";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

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

    const lockedUntil = result.data.lockedUntil.toDate
        ? result.data.lockedUntil.toDate()
        : new Date(result.data.lockedUntil);
    const now = new Date();
    if (lockedUntil > now) {
        return { locked: true, remainingMs: lockedUntil - now };
    }
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
        if (prevLock <= new Date()) {
            failCount = 1;
        }
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
    if (el) {
        el.textContent = now.toLocaleString('en-GB', options).replace(',', ' -');
    }
}

function updateCopyrightYear() {
    const yearEl = document.getElementById('copyright-year');
    if (yearEl) {
        yearEl.textContent = new Date().getFullYear();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    updateCopyrightYear();
    setInterval(updateDateTime, 1000);

    // ====== مستمع تغيير اللغة ======
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
        // تعيين اللغة الافتراضية عند التحميل
        setLanguage(langSelect.value);
        
        langSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
            // إعادة عرض النموذج الحالي حسب وجود login-form أو setup-form
            const loginForm = document.getElementById('login-form');
            const setupForm = document.getElementById('setup-form');
            if (loginForm) {
                renderLoginForm();
            } else if (setupForm) {
                renderSetupForm();
            } else {
                // إذا كان Dashboard ظاهراً، نعيد تحميل الصفحة لتطبيق اللغة
                window.location.reload();
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const changePasswordBtn = document.getElementById('change-password-btn');
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', renderChangePasswordForm);
    }

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled || btn.style.display === 'none') return;

            clearMessage('dashboard');

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.tab;
            if (tab === 'members') renderDashboard();
            else if (tab === 'logs') renderLogsView();
            else if (tab === 'cars') renderCarsView();
            else if (tab === 'requests') renderRequestsView();
            else if (tab === 'search') renderSearchView();
            else if (tab === 'stats') renderStatsView();
            else if (tab === 'my-activity') renderMyActivityView();
        });
    });

    onAuthStateChanged(auth, async (user) => {
        try {
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    userData.uid = user.uid;

                    const preferredLang = userData.preferredLanguage || getLanguage();
                    setLanguage(preferredLang);

                    setCurrentUser(userData);
                    setCarsCurrentUser(userData);
                    setRequestsCurrentUser(userData);
                    setLogsCurrentUser(userData);
                    setSearchCurrentUser(userData);
                    setStatsCurrentUser(userData);

                    document.querySelectorAll('.tab-btn').forEach(tab => {
                        if (userData.role === 'admin' && userData.status === 'active') {
                            tab.style.display = 'block';
                        } else {
                            tab.style.display = tab.dataset.tab === 'cars' ? 'block' : 'none';
                        }
                    });

                    const myActivityTab = document.getElementById('my-activity-tab');
                    if (myActivityTab) {
                        myActivityTab.style.display = userData.status === 'active' ? 'block' : 'none';
                    }

                    showDashboard();
                    updateRequestsBadge();
                } else {
                    await signOut(auth);
                    showAuthView();
                }
            } else {
                setCurrentUser(null);
                showAuthView();
                await checkSystemState();
            }
        } catch (error) {
            console.error('onAuthStateChanged error:', error);
            showAuthView();
            renderLoginForm(); // Force login form on error
        }
    });
});

function showAuthView() {
    const authView = document.getElementById('auth-view');
    const dashView = document.getElementById('dashboard-view');
    const logoutBtn = document.getElementById('logout-btn');
    const changePassBtn = document.getElementById('change-password-btn');
    const headerLogo = document.getElementById('header-logo');
    const mainLogo = document.getElementById('main-logo');
    const refreshBtn = document.getElementById('refresh-btn');

    if (authView) authView.style.display = 'flex';
    if (dashView) dashView.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (changePassBtn) changePassBtn.style.display = 'none';
    if (headerLogo) headerLogo.style.display = 'none';
    if (mainLogo) mainLogo.style.display = 'block';
    if (refreshBtn) refreshBtn.style.display = 'none';
}

function showDashboard() {
    const authView = document.getElementById('auth-view');
    const dashView = document.getElementById('dashboard-view');
    const logoutBtn = document.getElementById('logout-btn');
    const changePassBtn = document.getElementById('change-password-btn');
    const headerLogo = document.getElementById('header-logo');
    const mainLogo = document.getElementById('main-logo');
    const refreshBtn = document.getElementById('refresh-btn');

    if (authView) authView.style.display = 'none';
    if (dashView) dashView.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'block';
    if (changePassBtn) changePassBtn.style.display = 'block';
    if (headerLogo) headerLogo.style.display = 'block';
    if (mainLogo) mainLogo.style.display = 'none';
    if (refreshBtn) refreshBtn.style.display = 'block';

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const carsTab = document.querySelector('.tab-btn[data-tab="cars"]');
    if (carsTab) carsTab.classList.add('active');
    renderCarsView();
}

async function checkSystemState() {
    try {
        const statusRef = doc(db, 'system', 'status');
        const statusSnap = await getDoc(statusRef);
        
        if (statusSnap.exists()) {
            const data = statusSnap.data();
            if (data.usersCount > 0 || data.initialized === true) {
                renderLoginForm();
            } else {
                renderSetupForm();
            }
        } else {
            try {
                const q = query(collection(db, 'users'), limit(1));
                const snapshot = await getDocs(q);
                if (snapshot.empty) {
                    renderSetupForm();
                } else {
                    renderLoginForm();
                }
            } catch (e) {
                console.warn('Fallback to login form:', e.message);
                renderLoginForm();
            }
        }
    } catch (error) {
        console.error('checkSystemState error:', error);
        renderLoginForm();
    }
}

export function renderLoginForm() {
    const container = document.getElementById('form-container');
    if (!container) return;
    container.innerHTML = `
        <h2>${t('auth.login')}</h2>
        <form id="login-form">
            <div class="form-group">
                <label>${t('auth.email')}</label>
                <input type="email" id="login-email" required>
            </div>
            <div class="form-group">
                <label>${t('auth.password')}</label>
                <input type="password" id="login-password" required>
            </div>
            <div class="form-group checkbox-group">
                <input type="checkbox" id="remember-me">
                <label for="remember-me" style="margin-bottom:0">${t('auth.rememberMe')}</label>
            </div>
            <button type="submit" class="btn">${t('auth.login')}</button>
        </form>
    `;
    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

export function renderSetupForm() {
    const container = document.getElementById('form-container');
    if (!container) return;
    container.innerHTML = `
        <h2>${t('auth.setupTitle')}</h2>
        <p style="margin-bottom: 20px; font-size: 0.9rem; color: #666; text-align:center;">
            ${t('auth.setupDesc')}
        </p>
        <form id="setup-form">
            <div class="form-group">
                <label>${t('auth.username')}</label>
                <input type="text" id="username" required>
            </div>
            <div class="form-group">
                <label>${t('auth.email')}</label>
                <input type="email" id="email" required>
            </div>
            <div class="form-group">
                <label>${t('auth.password')}</label>
                <input type="password" id="password" required minlength="6">
            </div>
            <div class="form-group">
                <label>${t('auth.phone')}</label>
                <input type="text" id="phone" required pattern="0\\d{9}" placeholder="0XXXXXXXXX">
            </div>
            <div class="form-group">
                <label>${t('auth.securityPin')}</label>
                <input type="password" id="securityPin" required pattern="\\d{4}">
            </div>
            <button type="submit" class="btn">${t('auth.createSuperAdmin')}</button>
        </form>
    `;
    document.getElementById('setup-form').addEventListener('submit', handleSetup);
}

async function handleSetup(e) {
    e.preventDefault();
    lockUI();
    try {
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const phone = document.getElementById('phone').value.trim();
        const securityPin = document.getElementById('securityPin').value;

        if (!/^0\d{9}$/.test(phone)) {
            showMessage(t('error.phoneInvalid'), 'error');
            return;
        }
        if (!/^\d{4}$/.test(securityPin)) {
            showMessage(t('error.pinInvalid'), 'error');
            return;
        }

        const q = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnapshot = await getDocs(q);
        if (!usernameSnapshot.empty) {
            showMessage(t('error.usernameExists'), 'error');
            return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, 'users', uid), {
            username,
            email,
            phone,
            role: 'admin',
            status: 'active',
            notes: '',
            isProtected: true,
            securityPin,
            rememberSession: false,
            preferredLanguage: getLanguage()
        });

        await logAction({ uid, username }, 'SYSTEM_SETUP', {
            text: 'System initialized with Super Admin'
        });

        showMessage(t('auth.passwordUpdated'), 'success');
    } catch (error) {
        handleFirebaseError(error);
    } finally {
        unlockUI();
    }
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
        showMessage(t('error.general'), 'error');
        return;
    }

    lockUI();
    try {
        const lockStatus = await isLoginLocked(email);
        if (lockStatus.locked) {
            showMessage(
                `Too many failed attempts. Try again after ${formatRemainingLock(lockStatus.remainingMs)}.`,
                'error'
            );
            await logAction({ username: email }, 'LOGIN_FAILED', {
                text: `Locked account login attempt for ${email}`
            });
            return;
        }

        await auth.setPersistence(rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            showMessage(t('error.userNotFound'), 'error');
            await signOut(auth);
            return;
        }

        const userData = userDoc.data();
        if (userData.status === 'suspended') {
            await signOut(auth);
            await logAction({ username: email }, 'LOGIN_FAILED', {
                text: `Suspended account attempt: ${email}`
            });
            showMessage(t('error.userDisabled'), 'error');
            return;
        }

        await clearLoginAttempts(email);
        await updateDoc(doc(db, 'users', uid), { rememberSession: rememberMe });
        await logAction(userData, 'LOGIN', { text: t('dash.loggedIn') });

        const preferredLang = userData.preferredLanguage || getLanguage();
        setLanguage(preferredLang);

    } catch (error) {
        let failInfo = null;
        try {
            failInfo = await recordFailedLogin(email);
        } catch (recordErr) {
            console.error('Failed to record login attempt:', recordErr);
        }

        await logAction({ username: email }, 'LOGIN_FAILED', {
            text: `Failed login attempt for ${email}`
        });

        if (failInfo && failInfo.locked) {
            showMessage(t('error.tooManyRequests'), 'error');
        } else if (failInfo && failInfo.failCount) {
            const left = MAX_LOGIN_ATTEMPTS - failInfo.failCount;
            handleFirebaseError(error);
            if (left > 0) {
                showMessage(
                    `Login failed. ${left} attempt${left === 1 ? '' : 's'} remaining before lock.`,
                    'warning'
                );
            }
        } else {
            handleFirebaseError(error);
        }
    } finally {
        unlockUI();
    }
}

async function handleLogout() {
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                await logAction(userDoc.data(), 'LOGOUT', { text: t('dash.loggedOut') });
            }
        }
        await signOut(auth);
        showAuthView();
        await checkSystemState();
    } catch (error) {
        handleFirebaseError(error);
    }
}

export function renderChangePasswordForm() {
    const userData = getCurrentUser();
    if (!userData || !auth.currentUser) {
        showMessage(t('error.general'), 'error', 'dashboard');
        return;
    }

    const container = document.getElementById('dashboard-container');
    if (!container) return;

    clearMessage('dashboard');

    container.innerHTML = `
        <h2>${t('auth.changePassword')}</h2>
        <p style="color:#666; margin-bottom:20px; text-align:center;">
            ${t('auth.reauthenticateError')}
        </p>
        <form id="change-password-form" style="max-width:500px; margin:0 auto;">
            <div class="form-group">
                <label>${t('auth.currentPassword')}</label>
                <input type="password" id="cp-current" required minlength="6" autocomplete="current-password">
            </div>
            <div class="form-group">
                <label>${t('auth.newPassword')}</label>
                <input type="password" id="cp-new" required minlength="6" autocomplete="new-password">
            </div>
            <div class="form-group">
                <label>${t('auth.confirmNewPassword')}</label>
                <input type="password" id="cp-confirm" required minlength="6" autocomplete="new-password">
            </div>
            <button type="submit" class="btn" id="cp-submit">${t('auth.updatePassword')}</button>
            <button type="button" class="btn btn-secondary" id="cp-cancel" style="margin-top:10px;">${t('common.cancel')}</button>
        </form>
    `;

    const form = document.getElementById('change-password-form');
    const cancelBtn = document.getElementById('cp-cancel');
    if (form) form.addEventListener('submit', handleChangePassword);
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const carsTab = document.querySelector('.tab-btn[data-tab="cars"]');
            if (carsTab) carsTab.classList.add('active');
            renderCarsView();
        });
    }
}

async function handleChangePassword(e) {
    e.preventDefault();
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
        showMessage(t('auth.passwordMinLength'), 'error', 'dashboard');
        return;
    }
    if (newPassword !== confirmPassword) {
        showMessage(t('auth.passwordsDoNotMatch'), 'error', 'dashboard');
        return;
    }
    if (currentPassword === newPassword) {
        showMessage(t('auth.passwordSameAsCurrent'), 'error', 'dashboard');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = t('common.processing');
    }

    lockUI();
    try {
        const credential = EmailAuthProvider.credential(userData.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);

        await logAction(userData, 'CHANGE_PASSWORD', {
            targetId: userData.uid,
            targetName: userData.username,
            text: t('auth.passwordUpdated')
        });

        showMessage(t('auth.passwordUpdated'), 'success', 'dashboard');
        currentEl.value = '';
        newEl.value = '';
        confirmEl.value = '';

        setTimeout(() => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            const carsTab = document.querySelector('.tab-btn[data-tab="cars"]');
            if (carsTab) carsTab.classList.add('active');
            renderCarsView();
        }, 1500);
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = t('auth.updatePassword');
        }
        unlockUI();
    }
}

export async function updateRequestsBadge() {
    const badge = document.getElementById('requests-badge');
    if (!badge) return;

    try {
        const q = query(collection(db, 'requests'), where('status', '==', 'PENDING'));
        const snap = await getDocs(q);
        const count = snap.size;

        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    } catch (err) {
        badge.style.display = 'none';
    }
}

async function renderMyActivityView() {
    const { renderMyPersonalActivity } = await import('./members.js');
    renderMyPersonalActivity();
}