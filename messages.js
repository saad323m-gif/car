import { db } from './firebase.js';
import {
    collection, doc, getDocs, query, where, orderBy, limit, startAfter,
    writeBatch, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { logAction } from './logs.js';
import { addNotificationToBatch, createMessageNotification } from './notifications.js';
import { escapeAttribute, escapeHtml, formatDateTime, isActiveUser, isAdmin, sanitizePlainText, showMessage } from './utils.js';
import { t } from './i18n.js';

const MESSAGES_PAGE_SIZE = 10;
const MANAGEMENT_INBOX_ID = 'MANAGEMENT';
const RELATED_TYPES = new Set(['GENERAL', 'ASSIGNMENT', 'UNLINK_APPROVED', 'REASSIGNED', 'VIOLATION']);

let currentUserData = null;
let pageState = { records: [], lastDoc: null, visibleCount: 0, hasMore: false };
let composeContext = { relatedType: 'GENERAL', relatedId: null };
let activeUsers = [];

export function setMessagesCurrentUser(data) {
    currentUserData = data;
}

function cleanText(value, maxLength = 1000) {
    return sanitizePlainText(String(value ?? ''), maxLength);
}

function isManagementMessage(record) {
    return record?.recipientId === MANAGEMENT_INBOX_ID && record?.recipientRole === 'admin';
}

function canMarkRead(record) {
    if (!currentUserData || record?.readAt) return false;
    if (record.recipientId === currentUserData.uid) return true;
    return isAdmin(currentUserData) && isManagementMessage(record);
}

function isIncoming(record) {
    if (!currentUserData) return false;
    return record.recipientId === currentUserData.uid || (isAdmin(currentUserData) && isManagementMessage(record));
}

function peerName(record) {
    if (!currentUserData) return '';
    if (record.senderId === currentUserData.uid) {
        return displayRecipientName(record);
    }
    return record.senderName || t('User');
}

function relatedType(value) {
    return RELATED_TYPES.has(value) ? value : 'GENERAL';
}

function relatedLabel(value) {
    const labels = {
        GENERAL: 'General',
        ASSIGNMENT: 'Vehicle Assignment',
        UNLINK_APPROVED: 'Custody Release',
        REASSIGNED: 'Vehicle Reassignment',
        VIOLATION: 'Violation'
    };
    return t(labels[relatedType(value)] || 'General');
}

function displayRecipientName(record) {
    if (record?.recipientId === MANAGEMENT_INBOX_ID) return t('Management');
    return record?.recipientName || t('User');
}

function resetPageState() {
    pageState = { records: [], lastDoc: null, visibleCount: 0, hasMore: false };
    return pageState;
}

function getState(append) {
    return append ? pageState : resetPageState();
}

async function loadActiveUsers() {
    if (!isAdmin(currentUserData)) return [];
    const snapshot = await getDocs(query(collection(db, 'users'), where('status', '==', 'active')));
    activeUsers = snapshot.docs
        .map(item => ({ uid: item.id, ...item.data() }))
        .filter(user => user.uid !== currentUserData.uid)
        .sort((left, right) => String(left.username || '').localeCompare(String(right.username || '')));
    return activeUsers;
}

function composeRecipientOptions() {
    if (!isAdmin(currentUserData)) return '';
    const options = activeUsers.map(user => {
        const role = user.role === 'admin' ? t('Admin') : t('User');
        return `<option value="${escapeAttribute(user.uid)}">${escapeHtml(user.username || user.email || user.uid)} — ${escapeHtml(role)}</option>`;
    }).join('');
    return `
        <div class="form-group">
            <label for="message-recipient">${escapeHtml(t('Recipient'))}</label>
            <select id="message-recipient" required>
                <option value="">${escapeHtml(t('Select recipient'))}</option>
                ${options}
            </select>
        </div>
    `;
}

function composeFormHtml() {
    const relatedLabel = composeContext.relatedType !== 'GENERAL'
        ? `<p class="message-context-note">${escapeHtml(t('Related to'))}: ${escapeHtml(t(composeContext.relatedType))}</p>`
        : '';
    const recipient = isAdmin(currentUserData)
        ? composeRecipientOptions()
        : `<div class="message-management-recipient"><strong>${escapeHtml(t('Recipient'))}:</strong> ${escapeHtml(t('Management'))}</div>`;
    return `
        <div class="message-compose-wrapper">
            <button type="button" class="btn-add-toggle" id="toggle-message-form">+ ${escapeHtml(t('New Message'))}</button>
            <div id="message-form-wrapper" class="hidden-form">
                <form id="message-form" class="message-form" novalidate>
                    <h3>${escapeHtml(t('Send Internal Message'))}</h3>
                    <p>${escapeHtml(t('Messages may be viewed and answered by all authorised administrators.'))}</p>
                    ${relatedLabel}
                    ${recipient}
                    <div class="form-group full-width">
                        <label for="message-body">${escapeHtml(t('Message'))}</label>
                        <textarea id="message-body" required maxlength="1000" rows="5" placeholder="${escapeAttribute(t('Write your message here...'))}"></textarea>
                    </div>
                    <div class="message-actions">
                        <button type="submit" class="btn btn-sm" id="send-message-btn">${escapeHtml(t('Send Message'))}</button>
                        <button type="button" class="btn btn-sm btn-secondary" id="cancel-message-btn">${escapeHtml(t('Cancel'))}</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

export async function renderMessagesView(context = null) {
    if (context) {
        composeContext = {
            relatedType: relatedType(context.relatedType),
            relatedId: context.relatedId ? cleanText(context.relatedId, 128) : null
        };
    }
    const container = document.getElementById('dashboard-container');
    if (!container || !isActiveUser(currentUserData)) return;
    if (isAdmin(currentUserData)) {
        try {
            await loadActiveUsers();
        } catch (error) {
            console.error('Load message recipients failed:', error);
            activeUsers = [];
        }
    }
    container.innerHTML = `
        <section class="messages-page">
            <div class="messages-page-heading">
                <div>
                    <h2>${escapeHtml(t('Messages'))}</h2>
                    <p>${escapeHtml(isAdmin(currentUserData) ? t('Administrators can view and reply to all internal messages.') : t('Send messages only to management. All authorised administrators may review and reply.'))}</p>
                </div>
            </div>
            <div class="divider"></div>
            ${composeFormHtml()}
            <div id="messages-list" class="messages-list"><p class="loading-text">${escapeHtml(t('Loading messages...'))}</p></div>
        </section>
    `;
    bindMessageForm();
    loadMessages(false);
}

function bindMessageForm() {
    const toggle = document.getElementById('toggle-message-form');
    const wrapper = document.getElementById('message-form-wrapper');
    const form = document.getElementById('message-form');
    const cancel = document.getElementById('cancel-message-btn');
    if (toggle && wrapper) toggle.addEventListener('click', () => wrapper.classList.toggle('hidden-form'));
    if (cancel && wrapper && form) {
        cancel.addEventListener('click', () => {
            form.reset();
            composeContext = { relatedType: 'GENERAL', relatedId: null };
            wrapper.classList.add('hidden-form');
        });
    }
    if (form) form.addEventListener('submit', handleSendMessage);
}

function resolveRecipient() {
    if (!isAdmin(currentUserData)) {
        return {
            id: MANAGEMENT_INBOX_ID,
            name: 'Management',
            role: 'admin'
        };
    }
    const field = document.getElementById('message-recipient');
    const recipient = activeUsers.find(user => user.uid === field?.value);
    if (!recipient) return null;
    return {
        id: recipient.uid,
        name: cleanText(recipient.username || recipient.email || recipient.uid, 40),
        role: recipient.role === 'admin' ? 'admin' : 'user'
    };
}

async function handleSendMessage(event) {
    event.preventDefault();
    if (!isActiveUser(currentUserData)) return;
    const bodyField = document.getElementById('message-body');
    const button = document.getElementById('send-message-btn');
    const body = cleanText(bodyField?.value || '', 1000);
    const recipient = resolveRecipient();
    if (!recipient) {
        showMessage(t('Select a recipient before sending the message.'), 'error', 'dashboard');
        return;
    }
    if (!body) {
        showMessage(t('Enter a message before sending.'), 'error', 'dashboard');
        return;
    }
    if (button) {
        button.disabled = true;
        button.textContent = t('Sending...');
    }
    try {
        const messageRef = doc(collection(db, 'messages'));
        const batch = writeBatch(db);
        const payload = {
            senderId: currentUserData.uid,
            senderName: cleanText(currentUserData.username, 40),
            senderRole: isAdmin(currentUserData) ? 'admin' : 'user',
            recipientId: recipient.id,
            recipientName: recipient.name,
            recipientRole: recipient.role,
            participantIds: [currentUserData.uid, recipient.id],
            body,
            relatedType: relatedType(composeContext.relatedType),
            relatedId: composeContext.relatedId,
            createdAt: serverTimestamp(),
            readAt: null
        };
        batch.set(messageRef, payload);
        if (recipient.id !== MANAGEMENT_INBOX_ID) {
            addNotificationToBatch(batch, createMessageNotification({
                recipientId: recipient.id,
                messageId: messageRef.id,
                senderName: currentUserData.username,
                preview: body,
                senderId: currentUserData.uid
            }));
        }
        await batch.commit();
        try {
            await logAction(currentUserData, 'SEND_MESSAGE', {
                targetId: recipient.id,
                targetName: recipient.name,
                assigneeId: recipient.id === MANAGEMENT_INBOX_ID ? null : recipient.id,
                text: `Sent internal message to ${recipient.name}`
            });
        } catch (logError) {
            console.error('Message activity log failed:', logError);
        }
        showMessage(t('Message sent successfully.'), 'success', 'dashboard');
        const form = document.getElementById('message-form');
        const wrapper = document.getElementById('message-form-wrapper');
        if (form) form.reset();
        if (wrapper) wrapper.classList.add('hidden-form');
        composeContext = { relatedType: 'GENERAL', relatedId: null };
        loadMessages(false);
    } catch (error) {
        console.error('Send message failed:', error);
        showMessage(t('Unable to send the message. Please try again.'), 'error', 'dashboard');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = t('Send Message');
        }
    }
}

async function getMessageSnapshot(append) {
    if (!currentUserData) return null;
    if (isAdmin(currentUserData)) {
        const constraints = [orderBy('createdAt', 'desc'), limit(MESSAGES_PAGE_SIZE + 1)];
        if (append && pageState.lastDoc) constraints.splice(1, 0, startAfter(pageState.lastDoc));
        return getDocs(query(collection(db, 'messages'), ...constraints));
    }
    const [sentSnapshot, receivedSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'messages'), where('senderId', '==', currentUserData.uid))),
        getDocs(query(collection(db, 'messages'), where('recipientId', '==', currentUserData.uid)))
    ]);
    const uniqueDocuments = new Map();
    [...sentSnapshot.docs, ...receivedSnapshot.docs].forEach(item => uniqueDocuments.set(item.id, item));
    return { docs: [...uniqueDocuments.values()] };
}

export async function loadMessages(append = false) {
    const container = document.getElementById('messages-list');
    if (!container || !isActiveUser(currentUserData)) return;
    const state = getState(append);
    if (!append) container.innerHTML = `<p class="loading-text">${escapeHtml(t('Loading messages...'))}</p>`;
    try {
        const snapshot = await getMessageSnapshot(append);
        if (!snapshot) return;
        if (isAdmin(currentUserData)) {
            const pageDocs = snapshot.docs.slice(0, MESSAGES_PAGE_SIZE);
            const pageRecords = pageDocs.map(item => ({ id: item.id, ...item.data() }));
            state.records = append ? [...state.records, ...pageRecords] : pageRecords;
            state.lastDoc = pageDocs.length ? pageDocs[pageDocs.length - 1] : state.lastDoc;
            state.hasMore = snapshot.docs.length > pageDocs.length;
        } else {
            state.records = snapshot.docs.map(item => ({ id: item.id, ...item.data() }))
                .sort((left, right) => messageTime(right) - messageTime(left));
            if (!append) state.visibleCount = 0;
            state.visibleCount += MESSAGES_PAGE_SIZE;
            state.hasMore = state.records.length > state.visibleCount;
        }
        renderMessageRecords(container, state);
    } catch (error) {
        console.error('Load messages failed:', error);
        container.innerHTML = `<p class="error">${escapeHtml(t('Unable to load messages. Please try again.'))}</p>`;
    }
}

function messageTime(record) {
    const value = record?.createdAt;
    const date = value?.toDate ? value.toDate() : new Date(value || 0);
    return date.getTime();
}

function messageStatus(record) {
    if (record.readAt) return t('Read');
    return isIncoming(record) ? t('New') : t('Sent');
}

function renderMessageRecords(container, state) {
    const records = isAdmin(currentUserData) ? state.records : state.records.slice(0, state.visibleCount);
    if (!records.length) {
        container.innerHTML = `<p class="history-item">${escapeHtml(t('No messages found.'))}</p>`;
        return;
    }
    container.innerHTML = `<div class="message-records">${records.map(renderMessageCard).join('')}</div>`;
    records.forEach(record => bindMessageCard(record, container));
    if (state.hasMore) {
        const holder = document.createElement('div');
        holder.className = 'load-more-container';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'load-more-btn';
        button.textContent = t('Load More');
        button.addEventListener('click', () => loadMessages(true));
        holder.appendChild(button);
        container.appendChild(holder);
    }
}

function renderMessageCard(record) {
    const recordId = escapeAttribute(record.id);
    const detailsId = `message-details-${recordId}`;
    const direction = record.senderId === currentUserData?.uid ? t('To') : t('From');
    const peer = peerName(record);
    const adminSender = isAdmin(currentUserData) ? `<span class="message-summary-peer">${escapeHtml(record.senderName || '')} → ${escapeHtml(record.recipientName || '')}</span>` : `<span class="message-summary-peer">${escapeHtml(direction)}: ${escapeHtml(peer)}</span>`;
    return `
        <article class="message-card ${canMarkRead(record) ? 'message-unread' : ''}" id="message-${recordId}">
            <button type="button" class="message-card-summary" data-toggle-message="${recordId}" aria-expanded="false" aria-controls="${detailsId}">
                <span class="message-summary-title">${escapeHtml(record.body || '').slice(0, 90)}</span>
                ${adminSender}
                <span class="message-summary-time">${escapeHtml(formatDateTime(record.createdAt))}</span>
                <span class="message-status">${escapeHtml(messageStatus(record))}</span>
                <span class="message-card-chevron" aria-hidden="true">⌄</span>
            </button>
            <div class="message-card-details" id="${detailsId}" hidden>
                <p>${escapeHtml(record.body || '')}</p>
                <div class="message-meta-grid">
                    <span>${escapeHtml(t('From'))}: <strong>${escapeHtml(record.senderName || t('User'))}</strong></span>
                    <span>${escapeHtml(t('To'))}: <strong>${escapeHtml(displayRecipientName(record))}</strong></span>
                    <span>${escapeHtml(t('Sent'))}: <strong>${escapeHtml(formatDateTime(record.createdAt))}</strong></span>
                    <span>${escapeHtml(t('Related to'))}: <strong>${escapeHtml(relatedLabel(record.relatedType))}</strong></span>
                </div>
            </div>
        </article>
    `;
}

function bindMessageCard(record, container) {
    const card = container.querySelector(`#message-${CSS.escape(record.id)}`);
    const toggle = card?.querySelector(`[data-toggle-message="${CSS.escape(record.id)}"]`);
    const details = card?.querySelector(`#message-details-${CSS.escape(record.id)}`);
    if (toggle && details) {
        toggle.addEventListener('click', async () => {
            const willOpen = details.hidden;
            details.hidden = !willOpen;
            toggle.setAttribute('aria-expanded', String(willOpen));
            card.classList.toggle('open', willOpen);
            if (willOpen && canMarkRead(record)) await markMessageRead(record);
        });
    }
}

async function markMessageRead(record) {
    if (!canMarkRead(record)) return;
    try {
        await updateDoc(doc(db, 'messages', record.id), { readAt: serverTimestamp() });
        record.readAt = new Date();
        updateMessagesBadge();
    } catch (error) {
        console.error('Mark message read failed:', error);
    }
}

export async function updateMessagesBadge() {
    const badge = document.getElementById('messages-badge');
    if (!badge || !currentUserData || !isActiveUser(currentUserData)) return;
    try {
        let snapshot;
        if (isAdmin(currentUserData)) {
            snapshot = await getDocs(collection(db, 'messages'));
        } else {
            const [sentSnapshot, receivedSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'messages'), where('senderId', '==', currentUserData.uid))),
                getDocs(query(collection(db, 'messages'), where('recipientId', '==', currentUserData.uid)))
            ]);
            const uniqueDocuments = new Map();
            [...sentSnapshot.docs, ...receivedSnapshot.docs].forEach(item => uniqueDocuments.set(item.id, item));
            snapshot = { docs: [...uniqueDocuments.values()] };
        }
        const count = snapshot.docs.reduce((total, item) => total + (canMarkRead(item.data()) ? 1 : 0), 0);
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : String(count);
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    } catch (error) {
        console.error('Message badge failed:', error);
        badge.style.display = 'none';
    }
}

export function openMessagesForContext(context = {}) {
    composeContext = {
        relatedType: relatedType(context.relatedType),
        relatedId: context.relatedId ? cleanText(context.relatedId, 128) : null
    };
    const tab = document.querySelector('.tab-btn[data-tab="messages"]');
    if (tab) tab.click();
}
