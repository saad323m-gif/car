/**
 * Shared Utilities - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { auth } from "./firebase.js";
import { t, getLanguage, setLanguage, getActionTypeTranslation } from './i18n.js';

// إعادة تصدير دوال الترجمة لاستخدامها في الملفات الأخرى
export { t, getLanguage, setLanguage, getActionTypeTranslation };

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
            message = t('error.invalidEmail');
            break;
        case 'auth/user-disabled':
            message = t('error.userDisabled');
            break;
        case 'auth/user-not-found':
            message = t('error.userNotFound');
            break;
        case 'auth/wrong-password':
            message = t('error.wrongPassword');
            break;
        case 'auth/email-already-in-use':
            message = t('error.emailInUse');
            break;
        case 'auth/weak-password':
            message = t('error.weakPassword');
            break;
        case 'auth/too-many-requests':
            message = t('error.tooManyRequests');
            break;
        case 'auth/network-request-failed':
            message = t('error.network');
            break;
        case 'auth/requires-recent-login':
            message = t('error.requiresRecentLogin');
            break;
        case 'permission-denied':
            message = t('error.permissionDenied');
            break;
        default:
            message = `${t('error.unknown')} (${error.message || ''})`;
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
        return t('cars.fromNow', { start: startStr });
    }
    const endStr = formatDateTime(end);
    return t('cars.fromTo', { start: startStr, end: endStr });
}

/**
 * تنسيق تسمية السيارة بحيث يكون رقم اللوحة والرمز والإمارة هي الأساس
 */
export function formatCarLabel(carData) {
    if (!carData) return 'Unknown Car';
    const num = carData.plateNumber || '';
    const code = carData.plateCode || '';
    const emirate = carData.emirate || '';
    const id = carData.carId || '';
    const platePart = `${num} ${code} (${emirate})`.trim();
    if (platePart && platePart !== '()') {
        return id ? `${platePart} [${id}]` : platePart;
    }
    return id || 'Unknown Car';
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
            <h2>${t('common.accessDenied')}</h2>
            <p style="text-align:center; color:#666;">${t('common.accessDeniedText')}</p>
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

// ====== UI Lock ======
let uiLockCounter = 0;

export function lockUI() {
    uiLockCounter++;
    if (uiLockCounter > 1) return;

    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        z-index: 9999;
        display: flex;
        justify-content: center;
        align-items: center;
        backdrop-filter: blur(2px);
        cursor: wait;
    `;
    overlay.innerHTML = `
        <div style="
            background: #ffffff;
            padding: 30px 50px;
            border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            text-align: center;
        ">
            <div style="
                display: inline-block;
                width: 40px;
                height: 40px;
                border: 4px solid #e3f2fd;
                border-top: 4px solid #1976d2;
                border-radius: 50%;
                animation: spin 0.8s linear infinite;
                margin-bottom: 15px;
            "></div>
            <p style="color: #1976d2; font-weight: bold; margin: 0;">
                ${t('common.processing')}
            </p>
        </div>
    `;

    if (!document.getElementById('ui-spin-style')) {
        const style = document.createElement('style');
        style.id = 'ui-spin-style';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
}

export function unlockUI() {
    uiLockCounter--;
    if (uiLockCounter > 0) return;

    const overlay = document.getElementById('ui-overlay');
    if (overlay) {
        overlay.remove();
    }
    document.body.style.overflow = '';
    uiLockCounter = 0;
}