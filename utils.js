/**
 * Shared utilities for the Car Management System.
 * Dynamic values must be escaped before insertion into HTML templates.
 */

let messageTimeout = null;

export function showMessage(text, type = 'error', target = 'auth') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (!box) return;

    if (messageTimeout) {
        clearTimeout(messageTimeout);
        messageTimeout = null;
    }

    box.textContent = String(text || '');
    box.className = `message-box ${type}`;
    box.style.opacity = '1';

    const duration = String(text || '').length > 80 ? 7000 : 5500;
    messageTimeout = setTimeout(() => {
        box.classList.add('fade-out');
        setTimeout(() => {
            box.textContent = '';
            box.className = 'message-box';
            box.style.opacity = '1';
        }, 400);
    }, duration);
}

export function clearMessage(target = 'dashboard') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (!box) return;

    if (messageTimeout) {
        clearTimeout(messageTimeout);
        messageTimeout = null;
    }

    box.textContent = '';
    box.className = 'message-box';
    box.style.opacity = '1';
}

export function handleFirebaseError(error, target = 'auth') {
    const code = error?.code || '';
    let message = 'Unable to complete the request. Please try again.';

    if (code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
    } else if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        message = 'Invalid email or password.';
    } else if (code === 'auth/email-already-in-use') {
        message = 'This email address is already registered.';
    } else if (code === 'auth/weak-password') {
        message = 'Password does not meet the security requirements.';
    } else if (code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please wait a few minutes and try again.';
    } else if (code === 'auth/network-request-failed' || code === 'unavailable') {
        message = 'Network or service issue. Please check your connection and retry.';
    } else if (code === 'auth/requires-recent-login') {
        message = 'For security, please sign in again before continuing.';
    } else if (code === 'permission-denied') {
        message = 'You do not have permission to complete this action.';
    }

    showMessage(message, 'error', target);
}

/**
 * Compatibility support for the legacy four-digit protected-profile PIN.
 * Firebase password reauthentication remains the actual security boundary.
 */
export async function hashPin(pin) {
    const normalized = String(pin || '').trim();
    if (!/^\d{4}$/.test(normalized) || !globalThis.crypto?.subtle) return '';
    const encoded = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Supports historical plain-text values and SHA-256 values so an existing
 * protected account can be migrated without a forced PIN reset.
 */
export async function verifyPin(pin, storedValue) {
    const normalized = String(pin || '').trim();
    const stored = String(storedValue || '').trim();
    if (!/^\d{4}$/.test(normalized) || !stored) return false;
    if (/^\d{4}$/.test(stored)) return normalized === stored;
    return (await hashPin(normalized)) === stored;
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeAttribute(value) {
    return escapeHtml(value);
}

export function sanitizePlainText(value, maxLength = 500) {
    return String(value ?? '')
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .trim()
        .slice(0, maxLength);
}

export function formatDateTime(ts) {
    if (!ts) return 'N/A';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return 'N/A';

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
    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Dubai',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

export function formatPeriod(start, end) {
    const startStr = formatDateTime(start);
    return end ? `From ${startStr} to ${formatDateTime(end)}` : `From ${startStr} to Now`;
}

export function formatCarLabel(carData) {
    if (!carData) return 'Unknown Car';
    const id = carData.carId || 'N/A';
    const number = carData.plateNumber || '';
    const code = carData.plateCode || '';
    const emirate = carData.emirate || '';
    return `${id} | ${number} ${code} (${emirate})`;
}

export function isAdmin(userData) {
    return Boolean(userData && userData.role === 'admin' && userData.status === 'active');
}

export function isActiveUser(userData) {
    return Boolean(userData && userData.uid && userData.status === 'active');
}

export function renderAccessDenied() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    container.innerHTML = `
        <section class="access-denied" role="alert">
            <h2>Access Denied</h2>
            <p>You do not have permission to view this page.</p>
        </section>
    `;
}

export function daysUntil(expiry) {
    if (!expiry) return 0;
    const date = expiry.toDate ? expiry.toDate() : new Date(expiry);
    if (Number.isNaN(date.getTime())) return 0;

    const dubaiToday = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
    dubaiToday.setHours(0, 0, 0, 0);
    const dubaiExpiry = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dubai' }));
    dubaiExpiry.setHours(0, 0, 0, 0);
    return Math.ceil((dubaiExpiry - dubaiToday) / 86400000);
}

export function expiryClass(days) {
    if (days < 0) return 'date-expired';
    if (days <= 15) return 'date-warning';
    return 'date-valid';
}

export function toDateInputValue(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return '';

    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function emirateOptionsHtml(selected = '') {
    const emirates = [
        'Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman',
        'Fujairah', 'Umm Al Quwain', 'Ras Al Khaimah', 'Other'
    ];

    return emirates.map(emirate => {
        const isSelected = emirate === selected ? ' selected' : '';
        return `<option value="${escapeAttribute(emirate)}"${isSelected}>${escapeHtml(emirate)}</option>`;
    }).join('');
}

export function emptyStateHtml(text) {
    return `<p class="empty-state">${escapeHtml(text)}</p>`;
}

export function loadingHtml(text = 'Loading...') {
    return `<p class="loading-text">${escapeHtml(text)}</p>`;
}
