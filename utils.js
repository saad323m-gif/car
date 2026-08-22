/**
 * Shared Utilities - Car Management System
 * English only | Latin digits only | Production-ready
 * Updated: Full validators, debounce, confirm dialog, search merge helpers
 */

import { auth } from "./firebase.js";

let messageTimeout = null;
let activeSearchAbort = null;

/* ═══════════════════════════════════════════
   VALIDATORS
   ═══════════════════════════════════════════ */
export const validators = {
    phone: (v) => /^0\d{9}$/.test(String(v || '').trim()),
    pin: (v) => /^\d{4}$/.test(String(v || '').trim()),
    year: (v) => {
        const n = parseInt(v, 10);
        return !isNaN(n) && n >= 1900 && n <= new Date().getFullYear() + 1;
    },
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()),
    plateNumber: (v) => /^\d+$/.test(String(v || '').trim()),
    plateCode: (v) => /^[A-Za-z]{1,3}$/.test(String(v || '').trim()),
    username: (v) => /^[a-zA-Z0-9_]{3,30}$/.test(String(v || '').trim()),
    password: (v) => String(v || '').length >= 6,
};

export function validateField(id, validatorFn, errorMsg, target = 'dashboard') {
    const el = document.getElementById(id);
    if (!el) return { valid: false, value: '' };
    const value = el.value.trim();
    if (!validatorFn(value)) {
        showMessage(errorMsg, 'error', target);
        el.focus();
        return { valid: false, value };
    }
    return { valid: true, value };
}


/* ═══════════════════════════════════════════
   ENGLISH DIGITS VALIDATOR & CONVERTER
   Prevents Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) 
   and Eastern Arabic digits (٠١٢٣٤٥٦٧٨٩)
   ═══════════════════════════════════════════ */

const ARABIC_INDIC_DIGITS = /[٠١٢٣٤٥٦٧٨٩]/g;
const EASTERN_ARABIC_DIGITS = /[۰۱۲۳۴۵۶۷۸۹]/g;
const ALL_NON_ENGLISH_DIGITS = /[٠١٢٣٤٥٦٧٨۹۰۱۲۳۴۵۶۷۸۹]/g;

export function toEnglishDigits(str) {
    if (str == null) return '';
    return String(str)
        .replace(/٠/g, '0').replace(/١/g, '1').replace(/٢/g, '2')
        .replace(/٣/g, '3').replace(/٤/g, '4').replace(/٥/g, '5')
        .replace(/٦/g, '6').replace(/٧/g, '7').replace(/٨/g, '8').replace(/٩/g, '9')
        .replace(/۰/g, '0').replace(/۱/g, '1').replace(/۲/g, '2')
        .replace(/۳/g, '3').replace(/۴/g, '4').replace(/۵/g, '5')
        .replace(/۶/g, '6').replace(/۷/g, '7').replace(/۸/g, '8').replace(/۹/g, '9');
}

export function containsNonEnglishDigits(str) {
    return ALL_NON_ENGLISH_DIGITS.test(String(str || ''));
}

export function sanitizeInput(elId, options = {}) {
    const el = typeof elId === 'string' ? document.getElementById(elId) : elId;
    if (!el) return '';
    let value = toEnglishDigits(el.value.trim());
    if (options.uppercase) value = value.toUpperCase();
    if (options.lowercase) value = value.toLowerCase();
    // Update the input visually if it had non-English digits
    if (el.value.trim() !== value) {
        el.value = value;
    }
    return value;
}

/* ═══════════════════════════════════════════
   MESSAGES
   ═══════════════════════════════════════════ */
export function showMessage(text, type = 'error', target = 'auth') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (!box) return;

    if (messageTimeout) {
        clearTimeout(messageTimeout);
        messageTimeout = null;
    }

    box.textContent = text;
    box.className = `message-box ${type}`;
    box.style.opacity = '1';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');

    messageTimeout = setTimeout(() => {
        box.classList.add('fade-out');
        setTimeout(() => {
            box.textContent = '';
            box.className = 'message-box';
            box.style.opacity = '1';
            box.removeAttribute('role');
        }, 400);
    }, 5000);
}

export function clearMessage(target = 'dashboard') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (box) {
        if (messageTimeout) {
            clearTimeout(messageTimeout);
            messageTimeout = null;
        }
        box.textContent = '';
        box.className = 'message-box';
        box.style.opacity = '1';
    }
}

/* ═══════════════════════════════════════════
   DEBOUNCE & SEARCH HELPERS
   ═══════════════════════════════════════════ */
export function debounce(fn, ms = 400) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), ms);
    };
}

export function setActiveSearchAbort(controller) {
    if (activeSearchAbort) activeSearchAbort.abort();
    activeSearchAbort = controller;
}

export function getActiveSearchAbort() {
    return activeSearchAbort;
}

export function clearActiveSearchAbort() {
    activeSearchAbort = null;
}

/* ═══════════════════════════════════════════
   CONFIRM DIALOG (Accessible replacement for native confirm)
   ═══════════════════════════════════════════ */
export function renderConfirmDialog({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onConfirm, onCancel }) {
    const existing = document.getElementById('confirm-dialog-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'confirm-dialog-overlay';
    overlay.className = 'confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'confirm-dialog-title');

    overlay.innerHTML = `
        <div class="confirm-box">
            <h3 id="confirm-dialog-title">${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
            <div class="confirm-actions">
                <button class="btn btn-secondary" id="confirm-cancel">${escapeHtml(cancelText)}</button>
                <button class="btn ${danger ? 'btn-danger' : 'btn-success'}" id="confirm-ok">${escapeHtml(confirmText)}</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    const close = () => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 300);
        document.removeEventListener('keydown', onKey);
    };

    const onKey = (e) => {
        if (e.key === 'Escape') {
            close();
            if (onCancel) onCancel();
        }
    };

    okBtn.addEventListener('click', () => { close(); if (onConfirm) onConfirm(); });
    cancelBtn.addEventListener('click', () => { close(); if (onCancel) onCancel(); });
    document.addEventListener('keydown', onKey);
    okBtn.focus();
}

/* ═══════════════════════════════════════════
   LOADING STATE HELPERS
   ═══════════════════════════════════════════ */
export function setButtonLoading(btnId, loadingText = 'Processing...') {
    const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
    if (!btn) return;
    btn.dataset.originalText = btn.textContent;
    btn.dataset.originalDisabled = btn.disabled;
    btn.disabled = true;
    btn.textContent = loadingText;
    btn.setAttribute('aria-busy', 'true');
}

export function resetButtonLoading(btnId) {
    const btn = typeof btnId === 'string' ? document.getElementById(btnId) : btnId;
    if (!btn) return;
    btn.disabled = btn.dataset.originalDisabled === 'true';
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.removeAttribute('aria-busy');
}

/* ═══════════════════════════════════════════
   ERROR HANDLER
   ═══════════════════════════════════════════ */
export function handleFirebaseError(error, target = 'auth') {
    let message = '';
    switch (error.code) {
        case 'auth/invalid-email':
            message = 'Error: The email address is badly formatted.';
            break;
        case 'auth/user-disabled':
            message = 'Error: This user has been disabled.';
            break;
        case 'auth/user-not-found':
            message = 'Error: No user found with this email.';
            break;
        case 'auth/wrong-password':
            message = 'Error: Incorrect password. Please try again.';
            break;
        case 'auth/email-already-in-use':
            message = 'Error: The email is already in use.';
            break;
        case 'auth/weak-password':
            message = 'Error: Password should be at least 6 characters.';
            break;
        case 'auth/too-many-requests':
            message = 'Warning: Too many failed login attempts. Please try again later.';
            break;
        case 'auth/network-request-failed':
            message = 'Error: Network error. Check your connection.';
            break;
        case 'auth/requires-recent-login':
            message = 'Error: Please logout and login again to perform this action.';
            break;
        case 'permission-denied':
            message = 'Security Error: You do not have permission to perform this action.';
            break;
        default:
            message = `System Error: ${error.message || 'Unknown error occurred.'}`;
    }
    showMessage(message, 'error', target);
}

/* ═══════════════════════════════════════════
   FORMATTERS
   ═══════════════════════════════════════════ */
export function formatDateTime(ts) {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString('en-GB', {
        timeZone: 'Asia/Dubai',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
}

export function formatDateOnly(ts) {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Dubai',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

export function formatPeriod(start, end) {
    const startStr = formatDateTime(start);
    if (!end) return `From ${startStr} to Now`;
    return `From ${startStr} to ${formatDateTime(end)}`;
}

export function formatCarLabel(carData) {
    if (!carData) return 'Unknown Car';
    const id = carData.carId || 'N/A';
    const num = carData.plateNumber || '';
    const code = carData.plateCode || '';
    const emirate = carData.emirate || '';
    return `${id} | ${num} ${code} (${emirate})`;
}

/* ═══════════════════════════════════════════
   AUTH HELPERS
   ═══════════════════════════════════════════ */
export function isAdmin(userData) {
    return !!(userData && userData.role === 'admin' && userData.status === 'active');
}

export function isActiveUser(userData) {
    return !!(userData && userData.uid && userData.status === 'active');
}

export function renderAccessDenied() {
    const container = document.getElementById('dashboard-container');
    if (container) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🚫</div>
                <h2>Access Denied</h2>
                <p>You do not have permission to view this page.</p>
            </div>
        `;
    }
}

/* ═══════════════════════════════════════════
   DATE HELPERS
   ═══════════════════════════════════════════ */
export function daysUntil(expiry) {
    if (!expiry) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = expiry.toDate ? expiry.toDate() : new Date(expiry);
    return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

export function expiryClass(days) {
    if (days < 0) return 'date-expired';
    if (days <= 15) return 'date-warning';
    return 'date-valid';
}

export function toDateInputValue(ts) {
    if (!ts) return '';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        if (isNaN(d.getTime())) return '';
        return d.toISOString().split('T')[0];
    } catch {
        return '';
    }
}

/* ═══════════════════════════════════════════
   HTML ESCAPE
   ═══════════════════════════════════════════ */
export function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ═══════════════════════════════════════════
   CAR ID GENERATOR (extracted from cars.js + requests.js)
   ═══════════════════════════════════════════ */
import { doc, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "./firebase.js";

export async function generateCarId() {
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
