/**
 * Shared Utilities - Car Management System
 * English only | Latin digits only | Production-ready
 * Improved: hashed PIN support, richer messages, shared helpers
 */

import { auth } from "./firebase.js";

let messageTimeout = null;

/* ------------------------------------------------------------------ */
/*  Messaging                                                         */
/* ------------------------------------------------------------------ */

/**
 * Display a message (auto-dismiss after 6 seconds for longer texts)
 */
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

    const duration = text.length > 80 ? 7000 : 5500;
    messageTimeout = setTimeout(() => {
        box.classList.add('fade-out');
        setTimeout(() => {
            box.textContent = '';
            box.className = 'message-box';
            box.style.opacity = '1';
        }, 400);
    }, duration);
}

/**
 * Clear any visible message immediately
 */
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

/**
 * Centralized Firebase / general error handler with clearer messages
 */
export function handleFirebaseError(error, target = 'auth') {
    let message = '';
    switch (error.code) {
        case 'auth/invalid-email':
            message = 'Invalid email format. Please check the address and try again.';
            break;
        case 'auth/user-disabled':
            message = 'This account has been disabled. Contact an administrator.';
            break;
        case 'auth/user-not-found':
            message = 'No account found with this email address.';
            break;
        case 'auth/wrong-password':
            message = 'Incorrect password. Please try again.';
            break;
        case 'auth/invalid-credential':
            message = 'Invalid email or password. Please check your credentials.';
            break;
        case 'auth/email-already-in-use':
            message = 'This email is already registered to another account.';
            break;
        case 'auth/weak-password':
            message = 'Password is too weak. Use at least 6 characters.';
            break;
        case 'auth/too-many-requests':
            message = 'Too many failed attempts. Please wait a few minutes and try again.';
            break;
        case 'auth/network-request-failed':
            message = 'Network error. Check your internet connection and try again.';
            break;
        case 'auth/requires-recent-login':
            message = 'For security, please log out and log in again before performing this action.';
            break;
        case 'permission-denied':
            message = 'Permission denied. You do not have the required access for this action.';
            break;
        case 'unavailable':
            message = 'Service temporarily unavailable. Please try again shortly.';
            break;
        default:
            message = error.message
                ? `System error: ${error.message}`
                : 'An unexpected error occurred. Please try again.';
    }
    showMessage(message, 'error', target);
}

/* ------------------------------------------------------------------ */
/*  Security PIN hashing (SHA-256 via Web Crypto)                     */
/* ------------------------------------------------------------------ */

/**
 * Hash a 4-digit PIN using SHA-256.
 * Returns a 64-character hex string.
 */
export async function hashPin(pin) {
    if (!pin || typeof pin !== 'string') return '';
    const encoder = new TextEncoder();
    const data = encoder.encode(String(pin).trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a plain PIN against a stored value.
 * Supports both legacy plain-text (length 4) and hashed (length 64) values
 * so existing Super Admin accounts continue to work.
 */
export async function verifyPin(plainPin, storedValue) {
    if (!plainPin || !storedValue) return false;
    const stored = String(storedValue).trim();
    // Legacy plain-text PIN
    if (stored.length === 4 && /^\d{4}$/.test(stored)) {
        return plainPin === stored;
    }
    // Hashed PIN
    const hashed = await hashPin(plainPin);
    return hashed === stored;
}

/* ------------------------------------------------------------------ */
/*  Date / Label helpers                                              */
/* ------------------------------------------------------------------ */

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
            <h2>Access Denied</h2>
            <p style="text-align:center; color:#666; margin-top:12px;">
                You do not have permission to view this page.
            </p>
        `;
    }
}

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

/* ------------------------------------------------------------------ */
/*  Shared UI helpers (reduce duplication)                            */
/* ------------------------------------------------------------------ */

/** Standard emirate options HTML (used in multiple forms) */
export function emirateOptionsHtml(selected = '') {
    const emirates = [
        'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman',
        'Fujairah', 'Umm Al Quwain', 'Ras Al Khaimah', 'Other'
    ];
    return emirates.map(e =>
        `<option value="${e}" ${selected === e ? 'selected' : ''}>${e}</option>`
    ).join('');
}

/** Empty-state helper */
export function emptyStateHtml(text) {
    return `<p class="empty-state">${text}</p>`;
}

/** Loading text helper */
export function loadingHtml(text = 'Loading...') {
    return `<p class="loading-text">${text}</p>`;
}
