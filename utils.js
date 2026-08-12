/**
 * Shared Utilities - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { auth } from "./firebase.js";

/**
 * Display message in the appropriate message box
 * @param {string} text - Message text
 * @param {string} type - 'success' | 'error' | 'warning'
 * @param {string} target - 'auth' | 'dashboard'
 */
export function showMessage(text, type = 'error', target = 'auth') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (box) {
        box.textContent = text;
        box.className = `message-box ${type}`;
    }
}

/**
 * Centralized Firebase / general error handler
 * @param {Error} error
 * @param {string} target - 'auth' | 'dashboard'
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

/**
 * Format a Firestore Timestamp or Date to full English datetime with seconds (Asia/Dubai)
 * Example: "12 Aug 2025, 02:30:45 PM"
 * @param {FirebaseFirestore.Timestamp|Date|null} ts
 * @returns {string}
 */
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

/**
 * Format a date only (no time)
 * Example: "12 Aug 2025"
 * @param {FirebaseFirestore.Timestamp|Date|null} ts
 * @returns {string}
 */
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

/**
 * Build a human-readable period string for assignments / timelines
 * Ongoing : "From 12 Aug 2025, 02:30:45 PM to Now"
 * Closed  : "From 12 Aug 2025, 02:30:45 PM to 13 Aug 2025, 09:15:22 AM"
 * @param {FirebaseFirestore.Timestamp|Date|null} start
 * @param {FirebaseFirestore.Timestamp|Date|null} end
 * @returns {string}
 */
export function formatPeriod(start, end) {
    const startStr = formatDateTime(start);
    if (!end) {
        return `From ${startStr} to Now`;
    }
    const endStr = formatDateTime(end);
    return `From ${startStr} to ${endStr}`;
}

/**
 * Build a consistent car display label used everywhere
 * Example: "UAE-001 | 12345 A (Dubai)"
 * @param {object} carData - must contain carId, plateNumber, plateCode, emirate
 * @returns {string}
 */
export function formatCarLabel(carData) {
    if (!carData) return 'Unknown Car';
    const id = carData.carId || 'N/A';
    const num = carData.plateNumber || '';
    const code = carData.plateCode || '';
    const emirate = carData.emirate || '';
    return `${id} | ${num} ${code} (${emirate})`;
}

/**
 * Security guard - returns true only if current user is an active admin
 * @param {object|null} userData
 * @returns {boolean}
 */
export function isAdmin(userData) {
    return !!(userData && userData.role === 'admin' && userData.status === 'active');
}

/**
 * Security guard - returns true if user is logged in and active
 * @param {object|null} userData
 * @returns {boolean}
 */
export function isActiveUser(userData) {
    return !!(userData && userData.uid && userData.status === 'active');
}

/**
 * Simple access denied renderer
 */
export function renderAccessDenied() {
    const container = document.getElementById('dashboard-container');
    if (container) {
        container.innerHTML = `
            <h2>Access Denied</h2>
            <p style="text-align:center; color:#666;">You do not have permission to view this page.</p>
        `;
    }
}

/**
 * Calculate days remaining until a date (can be negative)
 * @param {FirebaseFirestore.Timestamp|Date} expiry
 * @returns {number}
 */
export function daysUntil(expiry) {
    if (!expiry) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = expiry.toDate ? expiry.toDate() : new Date(expiry);
    return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

/**
 * Return CSS class for expiry status
 * @param {number} days
 * @returns {string}
 */
export function expiryClass(days) {
    if (days < 0) return 'date-expired';
    if (days <= 15) return 'date-warning';
    return 'date-valid';
}

/**
 * Safely convert Firestore Timestamp / Date to YYYY-MM-DD for <input type="date">
 * @param {FirebaseFirestore.Timestamp|Date|null|undefined} ts
 * @returns {string}
 */
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
