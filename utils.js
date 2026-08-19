/**
 * Shared Utilities - Car Management System
 * English & Arabic support with Latin digits only
 */

import { auth } from "./firebase.js";

let messageTimeout = null;

// ====== الترجمة ======
const translations = {
    en: {
        'common.selectLanguage': 'Select Language',
        'common.processing': 'Processing...',
        'common.cancel': 'Cancel',
        'common.loading': 'Loading...',
        'common.accessDenied': 'Access Denied',
        'common.accessDeniedText': 'You do not have permission to view this page.',
        'auth.login': 'Login',
        'auth.email': 'Email',
        'auth.password': 'Password',
        'auth.rememberMe': 'Remember Me',
        'auth.setupTitle': 'System Setup',
        'auth.setupDesc': 'Create the protected Super Admin account.',
        'auth.username': 'Username',
        'auth.phone': 'Phone (Starts with 0, 10 digits)',
        'auth.securityPin': 'Security PIN (4 digits)',
        'auth.createSuperAdmin': 'Create Super Admin',
        'auth.changePassword': 'Change Password',
        'auth.currentPassword': 'Current Password',
        'auth.newPassword': 'New Password',
        'auth.confirmNewPassword': 'Confirm New Password',
        'auth.updatePassword': 'Update Password',
        'auth.passwordMinLength': 'Password must be at least 6 characters.',
        'auth.passwordsDoNotMatch': 'New password and confirmation do not match.',
        'auth.passwordSameAsCurrent': 'New password must be different from the current password.',
        'auth.passwordUpdated': 'Password updated successfully.',
        'auth.reauthenticateError': 'Please logout and login again to perform this action.',
        'dash.loggedIn': 'Logged into the system',
        'dash.loggedOut': 'Logged out',
        'error.general': 'An error occurred. Please try again.',
        'error.invalidEmail': 'The email address is badly formatted.',
        'error.userDisabled': 'This user has been disabled.',
        'error.userNotFound': 'No user found with this email.',
        'error.wrongPassword': 'Incorrect password. Please try again.',
        'error.emailInUse': 'The email is already in use.',
        'error.weakPassword': 'Password should be at least 6 characters.',
        'error.tooManyRequests': 'Too many failed login attempts. Please try again later.',
        'error.network': 'Network error. Check your connection.',
        'error.requiresRecentLogin': 'Please logout and login again to perform this action.',
        'error.permissionDenied': 'You do not have permission to perform this action.',
        'error.unknown': 'Unknown error occurred.',
        'error.phoneInvalid': 'Phone must start with 0 and be exactly 10 digits.',
        'error.usernameExists': 'Username already exists.',
        'error.pinInvalid': 'Security PIN must be exactly 4 digits.',
        'error.pinMismatch': 'New PIN and confirmation do not match.',
        'error.pinMustDiffer': 'New PIN must be different from the current PIN.',
        'error.passwordSame': 'New password must be different from the current password.',
        'error.passwordMismatch': 'New password and confirmation do not match.'
    },
    ar: {
        'common.selectLanguage': 'اختر اللغة',
        'common.processing': 'جاري المعالجة...',
        'common.cancel': 'إلغاء',
        'common.loading': 'جاري التحميل...',
        'common.accessDenied': 'تم رفض الوصول',
        'common.accessDeniedText': 'ليس لديك صلاحية لعرض هذه الصفحة.',
        'auth.login': 'تسجيل الدخول',
        'auth.email': 'البريد الإلكتروني',
        'auth.password': 'كلمة المرور',
        'auth.rememberMe': 'تذكرني',
        'auth.setupTitle': 'إعداد النظام',
        'auth.setupDesc': 'إنشاء حساب المدير العام المحمي.',
        'auth.username': 'اسم المستخدم',
        'auth.phone': 'رقم الهاتف (يبدأ بـ 0، 10 أرقام)',
        'auth.securityPin': 'رقم PIN الأمني (4 أرقام)',
        'auth.createSuperAdmin': 'إنشاء المدير العام',
        'auth.changePassword': 'تغيير كلمة المرور',
        'auth.currentPassword': 'كلمة المرور الحالية',
        'auth.newPassword': 'كلمة المرور الجديدة',
        'auth.confirmNewPassword': 'تأكيد كلمة المرور الجديدة',
        'auth.updatePassword': 'تحديث كلمة المرور',
        'auth.passwordMinLength': 'يجب أن تكون كلمة المرور 6 أحرف على الأقل.',
        'auth.passwordsDoNotMatch': 'كلمة المرور الجديدة وتأكيدها غير متطابقين.',
        'auth.passwordSameAsCurrent': 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.',
        'auth.passwordUpdated': 'تم تحديث كلمة المرور بنجاح.',
        'auth.reauthenticateError': 'يرجى تسجيل الخروج والدخول مرة أخرى لتنفيذ هذا الإجراء.',
        'dash.loggedIn': 'تم تسجيل الدخول إلى النظام',
        'dash.loggedOut': 'تم تسجيل الخروج',
        'error.general': 'حدث خطأ. يرجى المحاولة مرة أخرى.',
        'error.invalidEmail': 'البريد الإلكتروني غير صحيح.',
        'error.userDisabled': 'تم تعطيل هذا المستخدم.',
        'error.userNotFound': 'لا يوجد مستخدم بهذا البريد الإلكتروني.',
        'error.wrongPassword': 'كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.',
        'error.emailInUse': 'البريد الإلكتروني مستخدم بالفعل.',
        'error.weakPassword': 'يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.',
        'error.tooManyRequests': 'محاولات دخول فاشلة كثيرة. يرجى المحاولة لاحقاً.',
        'error.network': 'خطأ في الشبكة. تحقق من اتصالك.',
        'error.requiresRecentLogin': 'يرجى تسجيل الخروج والدخول مرة أخرى لتنفيذ هذا الإجراء.',
        'error.permissionDenied': 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
        'error.unknown': 'حدث خطأ غير معروف.',
        'error.phoneInvalid': 'يجب أن يبدأ رقم الهاتف بـ 0 وأن يكون 10 أرقام بالضبط.',
        'error.usernameExists': 'اسم المستخدم موجود بالفعل.',
        'error.pinInvalid': 'يجب أن يكون رقم PIN الأمني 4 أرقام بالضبط.',
        'error.pinMismatch': 'رقم PIN الجديد وتأكيده غير متطابقين.',
        'error.pinMustDiffer': 'يجب أن يختلف رقم PIN الجديد عن الحالي.',
        'error.passwordSame': 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.',
        'error.passwordMismatch': 'كلمة المرور الجديدة وتأكيدها غير متطابقين.'
    }
};

let currentLang = localStorage.getItem('preferredLanguage') || 'en';

export function getLanguage() {
    return currentLang;
}

export function setLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('preferredLanguage', lang);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
        const selector = document.getElementById('lang-select');
        if (selector) selector.value = lang;
    }
}

export function t(key, params = {}) {
    const keys = key.split('.');
    let value = translations[currentLang];
    for (const k of keys) {
        if (value && value[k] !== undefined) {
            value = value[k];
        } else {
            console.warn('Missing translation:', key);
            return key;
        }
    }
    if (typeof value !== 'string') {
        return key;
    }
    return value.replace(/\{(\w+)\}/g, (match, p1) => {
        return params[p1] !== undefined ? params[p1] : match;
    });
}

// ====== قفل الواجهة ======
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

// ====== الدوال الأصلية ======
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
        return `From ${startStr} to Now`;
    }
    const endStr = formatDateTime(end);
    return `From ${startStr} to ${endStr}`;
}

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