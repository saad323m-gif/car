/**
 * Main Application Entry - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { auth, db } from "./firebase.js";
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword,
    signOut, onAuthStateChanged, browserLocalPersistence, browserSessionPersistence,
    updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, limit,
    serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { renderDashboard, setCurrentUser, getCurrentUser } from "./members.js";
import { renderLogsView, logAction, setLogsCurrentUser } from "./logs.js";
import { renderCarsView, setCarsCurrentUser } from "./cars.js";
import { renderRequestsView, setRequestsCurrentUser } from "./requests.js";
import { renderSearchView, setSearchCurrentUser } from "./search.js";
import { renderStatsView, setStatsCurrentUser } from "./stats.js";
import { renderViolationsView, renderMyViolationsView, setViolationsCurrentUser } from "./violations.js";
import { showMessage, handleFirebaseError, clearMessage } from "./utils.js";
import { initializeI18n, attachLanguageSwitcher, formatDate, formatNumber } from "./i18n.js";

function updateDateTime() {
    const el = document.getElementById('datetime');
    if (!el) return;
    el.textContent = formatDate(new Date(), {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).replace(',', ' -').replace('،', ' -');
}

function updateCopyrightYear() {
    const yearEl = document.getElementById('copyright-year');
    if (yearEl) {
        yearEl.textContent = formatNumber(new Date().getFullYear(), { useGrouping: false });
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initializeI18n();
    attachLanguageSwitcher();
    updateDateTime();
    updateCopyrightYear();
    setInterval(updateDateTime, 1000);

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

    document.addEventListener('app-language-change', () => {
        updateDateTime();
        updateCopyrightYear();
        const dashboardVisible = document.getElementById('dashboard-view')?.style.display !== 'none';
        const activeTab = document.querySelector('.tab-btn.active');
        if (dashboardVisible && activeTab) activeTab.click();
        else renderLoginForm();
    });

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
            else if (tab === 'violations') renderViolationsView();
            else if (tab === 'my-violations') renderMyViolationsView();
            else if (tab === 'my-activity') renderMyActivityView();
        });
    });

    onAuthStateChanged(auth, async (user) => {
        try {
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                    await signOut(auth);
                    showAuthView();
                    showMessage('Your account is not registered in this system.', 'error');
                    return;
                }

                const userData = { ...userDoc.data(), uid: user.uid };
                if (userData.status !== 'active') {
                    await signOut(auth);
                    showAuthView();
                    showMessage('Access is currently unavailable for this account.', 'error');
                    return;
                }

                setCurrentUser(userData);
                setCarsCurrentUser(userData);
                setRequestsCurrentUser(userData);
                setLogsCurrentUser(userData);
                setSearchCurrentUser(userData);
                setStatsCurrentUser(userData);
                setViolationsCurrentUser(userData);

                document.querySelectorAll('.tab-btn').forEach(tab => {
                    const publicUserTabs = ['cars', 'my-activity', 'my-violations'];
                    tab.style.display = userData.role === 'admin' || publicUserTabs.includes(tab.dataset.tab)
                        ? 'block'
                        : 'none';
                });

                const myActivityTab = document.getElementById('my-activity-tab');
                if (myActivityTab) {
                    myActivityTab.style.display = 'block';
                }

                showDashboard();
                updateRequestsBadge();
                return;
            }

            setCurrentUser(null);
            showAuthView();
            await checkSystemState();
        } catch (error) {
            console.error('Authentication state handling failed:', error);
            showAuthView();
            showMessage('Unable to load your account. Please refresh and try again.', 'error');
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
        const statusSnap = await getDoc(doc(db, 'system', 'status'));
        renderLoginForm();
    } catch (error) {
        console.error('System state check failed:', error);
        renderLoginForm();
    }
}

function renderLoginForm() {
    document.getElementById('form-container').innerHTML = `
        <h2>Login</h2>
        <form id="login-form">
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="login-email" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="login-password" required>
            </div>
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
        showMessage('Error: Email and password are required.', 'error');
        return;
    }

    try {
        await auth.setPersistence(rememberMe ? browserLocalPersistence : browserSessionPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            showMessage('Error: User data not found.', 'error');
            await signOut(auth);
            return;
        }

        const userData = userDoc.data();
        if (userData.status === 'suspended') {
            await signOut(auth);
            await logAction({ username: email }, 'LOGIN_FAILED', {
                text: `Suspended account attempt: ${email}`
            });
            showMessage('Access denied: Your account has been suspended. Please contact an administrator.', 'error');
            return;
        }

        await logAction({ ...userData, uid }, 'LOGIN', { text: 'User logged in' });
    } catch (error) {
        handleFirebaseError(error);
    }
}

async function handleLogout() {
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                await logAction({ ...userDoc.data(), uid: currentUser.uid }, 'LOGOUT', { text: 'User logged out' });
            }
        }
        await signOut(auth);
        showAuthView();
        await checkSystemState();
    } catch (error) {
        handleFirebaseError(error);
    }
}

function renderChangePasswordForm() {
    const userData = getCurrentUser();
    if (!userData || !auth.currentUser) {
        showMessage('You must be logged in to change password.', 'error', 'dashboard');
        return;
    }

    const container = document.getElementById('dashboard-container');
    if (!container) return;

    clearMessage('dashboard');

    container.innerHTML = `
        <h2>Change Password</h2>
        <p style="color:#666; margin-bottom:20px; text-align:center;">
            Enter your current password, then choose a new one.
        </p>
        <form id="change-password-form" style="max-width:500px; margin:0 auto;">
            <div class="form-group">
                <label>Current Password</label>
                <input type="password" id="cp-current" required minlength="6" autocomplete="current-password">
            </div>
            <div class="form-group">
                <label>New Password</label>
                <input type="password" id="cp-new" required minlength="6" autocomplete="new-password">
            </div>
            <div class="form-group">
                <label>Confirm New Password</label>
                <input type="password" id="cp-confirm" required minlength="6" autocomplete="new-password">
            </div>
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
        showMessage('New password must be at least 6 characters long.', 'error', 'dashboard');
        return;
    }
    if (newPassword !== confirmPassword) {
        showMessage('New password and confirmation do not match. Please re-enter them carefully.', 'error', 'dashboard');
        return;
    }
    if (currentPassword === newPassword) {
        showMessage('New password must be different from your current password.', 'error', 'dashboard');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
    }

    try {
        const credential = EmailAuthProvider.credential(userData.email, currentPassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);

        await logAction(userData, 'CHANGE_PASSWORD', {
            targetId: userData.uid,
            targetName: userData.username,
            text: `Password changed by ${userData.username}`
        });

        showMessage('Password updated successfully. You can continue using the system with the new password.', 'success', 'dashboard');
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
            submitBtn.textContent = 'Update Password';
        }
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

// New function for My Activity tab
async function renderMyActivityView() {
    const { renderMyPersonalActivity } = await import('./members.js');
    renderMyPersonalActivity();
}