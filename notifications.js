import { db } from './firebase.js';
import {
    collection, doc, getDocs, query, where, orderBy, limit, startAfter,
    updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { escapeAttribute, escapeHtml, formatCarLabel, formatDateTime, isActiveUser, isAdmin, renderAccessDenied, showMessage } from './utils.js';
import { getLanguage, t } from './i18n.js';

const NOTIFICATIONS_PAGE_SIZE = 10;
const NOTIFICATION_TYPES = new Set(['ASSIGNMENT', 'UNLINK_APPROVED', 'REASSIGNED', 'VIOLATION', 'MESSAGE']);

let currentUserData = null;
let pageState = { records: [], lastDoc: null, visibleCount: 0, hasMore: false };

export function setNotificationsCurrentUser(data) {
    currentUserData = data;
}

function cleanText(value, maxLength = 500) {
    return String(value ?? '').replace(/[<>]/g, '').trim().slice(0, maxLength);
}

function notificationId() {
    return doc(collection(db, 'notifications')).id;
}

function validType(type) {
    return NOTIFICATION_TYPES.has(type) ? type : 'MESSAGE';
}

function plainCarLabel(carData) {
    return cleanText(formatCarLabel(carData || {}), 160);
}

function createPayload(data) {
    return {
        recipientId: cleanText(data.recipientId, 128),
        type: validType(data.type),
        titleEn: cleanText(data.titleEn, 120),
        titleAr: cleanText(data.titleAr, 120),
        bodyEn: cleanText(data.bodyEn, 500),
        bodyAr: cleanText(data.bodyAr, 500),
        relatedCarId: data.relatedCarId ? cleanText(data.relatedCarId, 128) : null,
        relatedViolationId: data.relatedViolationId ? cleanText(data.relatedViolationId, 128) : null,
        relatedMessageId: data.relatedMessageId ? cleanText(data.relatedMessageId, 128) : null,
        createdBy: cleanText(data.createdBy, 128),
        createdByName: cleanText(data.createdByName, 40),
        createdAt: serverTimestamp(),
        readAt: null,
        acknowledgedAt: null
    };
}

export function createAssignmentNotification({ recipientId, carData, actorId, actorName }) {
    const carLabel = plainCarLabel(carData);
    return createPayload({
        recipientId,
        type: 'ASSIGNMENT',
        titleEn: 'Vehicle Assignment',
        titleAr: 'تعيين مركبة',
        bodyEn: `${actorName} assigned you to ${carLabel}. Your custody starts at the recorded assignment time.`,
        bodyAr: `قام ${actorName} بتعيينك على المركبة ${carLabel}. تبدأ عهدتك من وقت التعيين المسجل في النظام.`,
        relatedCarId: carData?.carId || null,
        createdBy: actorId,
        createdByName: actorName
    });
}

export function createUnlinkNotification({ recipientId, carData, actorId, actorName }) {
    const carLabel = plainCarLabel(carData);
    return createPayload({
        recipientId,
        type: 'UNLINK_APPROVED',
        titleEn: 'Custody Release Approved',
        titleAr: 'تم اعتماد فك العهدة',
        bodyEn: `${actorName} approved the custody release for ${carLabel}. Your recorded custody has ended at the recorded time.`,
        bodyAr: `قام ${actorName} باعتماد فك العهدة عن المركبة ${carLabel}. انتهت عهدتك المسجلة في وقت الإنهاء المدون بالنظام.`,
        relatedCarId: carData?.carId || null,
        createdBy: actorId,
        createdByName: actorName
    });
}

export function createReassignmentNotification({ recipientId, carData, actorId, actorName }) {
    const carLabel = plainCarLabel(carData);
    return createPayload({
        recipientId,
        type: 'REASSIGNED',
        titleEn: 'Vehicle Reassigned',
        titleAr: 'تم نقل عهدة المركبة',
        bodyEn: `${actorName} linked ${carLabel} to a new user. Your recorded custody has ended at the recorded reassignment time.`,
        bodyAr: `قام ${actorName} بربط المركبة ${carLabel} بمستخدم جديد. انتهت عهدتك المسجلة في وقت النقل المدون بالنظام.`,
        relatedCarId: carData?.carId || null,
        createdBy: actorId,
        createdByName: actorName
    });
}

export function createViolationNotification({ recipientId, violationId, carLabel, violationType, violationAt, amount, actorId, actorName }) {
    const value = Number(amount || 0);
    const amountText = Number.isFinite(value) && value > 0 ? ` Amount: ${value}.` : '';
    const amountTextAr = Number.isFinite(value) && value > 0 ? ` المبلغ: ${value}.` : '';
    const safeCarLabel = cleanText(carLabel, 160);
    const safeType = cleanText(violationType, 80);
    const dateText = formatDateTime(violationAt);
    return createPayload({
        recipientId,
        type: 'VIOLATION',
        titleEn: 'Violation Linked to Your Record',
        titleAr: 'مخالفة مرتبطة بسجلك',
        bodyEn: `Violation ${violationId} was linked to your record for ${safeCarLabel}. Type: ${safeType}. Occurred: ${dateText}.${amountText}`,
        bodyAr: `تم ربط المخالفة ${violationId} بسجلك للمركبة ${safeCarLabel}. النوع: ${safeType}. وقت الوقوع: ${dateText}.${amountTextAr}`,
        relatedViolationId: violationId,
        createdBy: actorId,
        createdByName: actorName
    });
}

export function createMessageNotification({ recipientId, messageId, senderName, preview, senderId }) {
    return createPayload({
        recipientId,
        type: 'MESSAGE',
        titleEn: 'New Internal Message',
        titleAr: 'رسالة داخلية جديدة',
        bodyEn: `${senderName}: ${cleanText(preview, 120)}`,
        bodyAr: `${senderName}: ${cleanText(preview, 120)}`,
        relatedMessageId: messageId,
        createdBy: senderId,
        createdByName: senderName
    });
}

export function addNotificationToBatch(batch, notification) {
    const payload = createPayload(notification);
    const reference = doc(db, 'notifications', notificationId());
    batch.set(reference, payload);
    return reference;
}

export function addNotificationToTransaction(transaction, notification) {
    const payload = createPayload(notification);
    const reference = doc(db, 'notifications', notificationId());
    transaction.set(reference, payload);
    return reference;
}

function notificationTitle(record) {
    return getLanguage() === 'ar' ? record.titleAr || record.titleEn : record.titleEn || record.titleAr;
}

function notificationBody(record) {
    return getLanguage() === 'ar' ? record.bodyAr || record.bodyEn : record.bodyEn || record.bodyAr;
}

function notificationTime(record) {
    const source = record?.createdAt;
    const date = source?.toDate ? source.toDate() : new Date(source || 0);
    return date.getTime();
}

function unread(record) {
    return !record?.readAt;
}

function resetPageState() {
    pageState = { records: [], lastDoc: null, visibleCount: 0, hasMore: false };
    return pageState;
}

function getState(append) {
    return append ? pageState : resetPageState();
}

async function getNotificationSnapshot(append) {
    if (!currentUserData) return null;
    if (isAdmin(currentUserData)) {
        const constraints = [orderBy('createdAt', 'desc'), limit(NOTIFICATIONS_PAGE_SIZE + 1)];
        if (append && pageState.lastDoc) constraints.splice(1, 0, startAfter(pageState.lastDoc));
        return getDocs(query(collection(db, 'notifications'), ...constraints));
    }
    return getDocs(query(collection(db, 'notifications'), where('recipientId', '==', currentUserData.uid)));
}

export async function updateNotificationsBadge() {
    const badge = document.getElementById('notifications-badge');
    if (!badge || !currentUserData || !isActiveUser(currentUserData)) return;
    try {
        const snapshot = await getDocs(query(collection(db, 'notifications'), where('recipientId', '==', currentUserData.uid)));
        const count = snapshot.docs.reduce((total, item) => total + (item.data().readAt ? 0 : 1), 0);
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        badge.style.display = 'none';
        console.error('Notification badge failed:', error);
    }
}

export function renderNotificationsView() {
    const container = document.getElementById('dashboard-container');
    if (!container || !isActiveUser(currentUserData)) return;
    container.innerHTML = `
        <section class="notifications-page">
            <div class="notifications-page-heading">
                <div>
                    <h2>${escapeHtml(t('Notifications'))}</h2>
                    <p>${escapeHtml(t('Review assignment, custody, violation, and message notices.'))}</p>
                </div>
            </div>
            <div class="divider"></div>
            <div id="notifications-list" class="notifications-list"><p class="loading-text">${escapeHtml(t('Loading notifications...'))}</p></div>
        </section>
    `;
    loadNotifications(false);
}

export async function loadNotifications(append = false) {
    const container = document.getElementById('notifications-list');
    if (!container || !currentUserData || !isActiveUser(currentUserData)) return;
    const state = getState(append);
    if (!append) container.innerHTML = `<p class="loading-text">${escapeHtml(t('Loading notifications...'))}</p>`;
    try {
        const snapshot = await getNotificationSnapshot(append);
        if (!snapshot) return;
        if (isAdmin(currentUserData)) {
            const pageDocs = snapshot.docs.slice(0, NOTIFICATIONS_PAGE_SIZE);
            const pageRecords = pageDocs.map(item => ({ id: item.id, ...item.data() }));
            state.records = append ? [...state.records, ...pageRecords] : pageRecords;
            state.lastDoc = pageDocs.length ? pageDocs[pageDocs.length - 1] : state.lastDoc;
            state.hasMore = snapshot.docs.length > pageDocs.length;
        } else {
            state.records = snapshot.docs.map(item => ({ id: item.id, ...item.data() })).sort((left, right) => notificationTime(right) - notificationTime(left));
            if (!append) state.visibleCount = 0;
            state.visibleCount += NOTIFICATIONS_PAGE_SIZE;
            state.hasMore = state.records.length > state.visibleCount;
        }
        renderNotificationRecords(container, state);
    } catch (error) {
        console.error('Load notifications failed:', error);
        container.innerHTML = `<p class="error">${escapeHtml(t('Unable to load notifications. Please try again.'))}</p>`;
    }
}

function renderNotificationRecords(container, state) {
    const records = isAdmin(currentUserData) ? state.records : state.records.slice(0, state.visibleCount);
    if (!records.length) {
        container.innerHTML = `<p class="history-item">${escapeHtml(t('No notifications found.'))}</p>`;
        return;
    }
    container.innerHTML = `<div class="notification-records">${records.map(renderNotificationCard).join('')}</div>`;
    records.forEach(record => bindNotificationCard(record, container));
    if (state.hasMore) {
        const holder = document.createElement('div');
        holder.className = 'load-more-container';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'load-more-btn';
        button.textContent = t('Load More');
        button.addEventListener('click', () => loadNotifications(true));
        holder.appendChild(button);
        container.appendChild(holder);
    }
}

function renderNotificationCard(record) {
    const recordId = escapeAttribute(record.id);
    const detailsId = `notification-details-${recordId}`;
    const status = unread(record) ? t('New') : t('Read');
    const userLabel = isAdmin(currentUserData) ? `<span class="notification-recipient">${escapeHtml(record.recipientId || '')}</span>` : '';
    return `
        <article class="notification-card ${unread(record) ? 'notification-unread' : ''}" id="notification-${recordId}">
            <button type="button" class="notification-card-summary" data-toggle-notification="${recordId}" aria-expanded="false" aria-controls="${detailsId}">
                <span class="notification-summary-title">${escapeHtml(notificationTitle(record))}</span>
                ${userLabel}
                <span class="notification-summary-time">${escapeHtml(formatDateTime(record.createdAt))}</span>
                <span class="notification-status">${escapeHtml(status)}</span>
                <span class="notification-card-chevron" aria-hidden="true">⌄</span>
            </button>
            <div class="notification-card-details" id="${detailsId}" hidden>
                <p>${escapeHtml(notificationBody(record))}</p>
                <div class="notification-meta-grid">
                    <span>${escapeHtml(t('Issued by'))}: <strong>${escapeHtml(record.createdByName || t('System'))}</strong></span>
                    <span>${escapeHtml(t('Issued'))}: <strong>${escapeHtml(formatDateTime(record.createdAt))}</strong></span>
                </div>
                <div class="notification-actions">
                    ${record.acknowledgedAt ? `<span class="notification-acknowledged">${escapeHtml(t('Acknowledged'))}: ${escapeHtml(formatDateTime(record.acknowledgedAt))}</span>` : `<button type="button" class="action-btn action-btn-acknowledge" data-acknowledge-notification="${recordId}">${escapeHtml(t('Acknowledge'))}</button>`}
                    ${['ASSIGNMENT', 'UNLINK_APPROVED', 'REASSIGNED', 'VIOLATION'].includes(record.type) ? `<button type="button" class="action-btn action-btn-message" data-message-notification="${recordId}">${escapeHtml(t('Message Management'))}</button>` : ''}
                </div>
            </div>
        </article>
    `;
}

function bindNotificationCard(record, container) {
    const card = container.querySelector(`#notification-${CSS.escape(record.id)}`);
    const toggle = card?.querySelector(`[data-toggle-notification="${CSS.escape(record.id)}"]`);
    const details = card?.querySelector(`#notification-details-${CSS.escape(record.id)}`);
    if (toggle && details) {
        toggle.addEventListener('click', async () => {
            const willOpen = details.hidden;
            details.hidden = !willOpen;
            toggle.setAttribute('aria-expanded', String(willOpen));
            card.classList.toggle('open', willOpen);
            if (willOpen && unread(record)) await markNotificationRead(record);
        });
    }
    const acknowledge = card?.querySelector(`[data-acknowledge-notification="${CSS.escape(record.id)}"]`);
    if (acknowledge) acknowledge.addEventListener('click', () => acknowledgeNotification(record));
    const message = card?.querySelector(`[data-message-notification="${CSS.escape(record.id)}"]`);
    if (message) {
        message.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('open-management-message', {
                detail: { relatedType: record.type, relatedId: record.relatedViolationId || record.relatedCarId || null }
            }));
        });
    }
}

async function markNotificationRead(record) {
    if (!currentUserData || record.recipientId !== currentUserData.uid || record.readAt) return;
    try {
        await updateDoc(doc(db, 'notifications', record.id), { readAt: serverTimestamp() });
        record.readAt = new Date();
        updateNotificationsBadge();
    } catch (error) {
        console.error('Mark notification read failed:', error);
    }
}

async function acknowledgeNotification(record) {
    if (!currentUserData || record.recipientId !== currentUserData.uid || record.acknowledgedAt) return;
    try {
        const update = { acknowledgedAt: serverTimestamp() };
        if (!record.readAt) update.readAt = serverTimestamp();
        await updateDoc(doc(db, 'notifications', record.id), update);
        if (!record.readAt) record.readAt = new Date();
        record.acknowledgedAt = new Date();
        showMessage(t('Notification acknowledged.'), 'success', 'dashboard');
        renderNotificationRecords(document.getElementById('notifications-list'), pageState);
        updateNotificationsBadge();
    } catch (error) {
        console.error('Acknowledge notification failed:', error);
        showMessage(t('Unable to acknowledge this notification. Please try again.'), 'error', 'dashboard');
    }
}
