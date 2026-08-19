/**
 * Shared Utilities - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { auth } from "./firebase.js";

let messageTimeout = null;

/**
 * Display message in the appropriate message box
 * Auto-dismiss after 5 seconds
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

    messageTimeout = setTimeout(() => {
        box.classList.add('fade-out');
        setTimeout(() => {
            box.textContent = '';
            box.className = 'message-box';
            box.style.opacity = '1';
        }, 400);
    }, 5000);
}

/**
 * Clear any visible message immediately (used on tab change)
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
 * Centralized Firebase / general error handler
 */
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
    if (!end) {
        return `From ${startStr} to Now`;
    }
    const endStr = formatDateTime(end);
    return `From ${startStr} to ${endStr}`;
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
            <p style="text-align:center; color:#666;">You do not have permission to view this page.</p>
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
// ====== الترجمة البسيطة (إنجليزية فقط حالياً) ======
export function t(key, params = {}) {
    // ترجمة بسيطة: نعيد المفتاح نفسه مع استبدال المتغيرات
    return key.replace(/\{(\w+)\}/g, (match, p1) => {
        return params[p1] !== undefined ? params[p1] : match;
    });
}

export function setLanguage(lang) {
    localStorage.setItem('preferredLanguage', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
}

export function getLanguage() {
    return localStorage.getItem('preferredLanguage') || 'en';
}