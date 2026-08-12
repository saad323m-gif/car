/**
 * Logs Module - Car Management System
 * English only | Latin digits only | Production-ready
 * Logs are immutable - no edit or delete functionality exists.
 */

import { db } from "./firebase.js";
import {
    collection, addDoc, query, orderBy, limit, startAfter, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showDashboardMessage } from "./messageManager.js";
import { setLoading, appendLoading, removeLoading, disableLoadMoreButton, enableLoadMoreButton, UI_TEXTS } from "./loadingManager.js";
import { isAdmin, renderAccessDenied, formatDateTime } from "./utils.js";

let lastVisibleLog = null;
let currentUserData = null;

export const setLogsCurrentUser = (data) => { currentUserData = data; };

export async function logAction(actor, actionType, details = {}) {
    try {
        await addDoc(collection(db, 'logs'), {
            timestamp: serverTimestamp(),
            actorId: actor.uid || 'system',
            actorName: actor.username || 'System',
            actionType: actionType,
            targetId: details.targetId || null,
            targetName: details.targetName || null,
            assigneeId: details.assigneeId || null,
            details: details.text || ''
        });
    } catch (error) { console.error('Logging failed:', error); }
}

export function renderLogsView() {
    if (!isAdmin(currentUserData)) { renderAccessDenied(); return; }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>System Logs Timeline</h2>
        <p style="text-align: center; color: #666; margin-bottom: 20px;">Immutable audit trail of all system activities.</p>
        <div class="divider"></div>
        <div id="logs-timeline" class="timeline"></div>
        <div id="load-more-container" class="load-more-container"></div>
    `;
    lastVisibleLog = null;
    fetchLogs(false);
}

async function fetchLogs(loadMore = false) {
    if (!isAdmin(currentUserData)) return;
    const listContainer = document.getElementById('logs-timeline');
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!listContainer) return;

    if (loadMore && loadMoreBtn) disableLoadMoreButton(loadMoreBtn);
    if (!loadMore) setLoading(listContainer, UI_TEXTS.LOADING);
    else appendLoading(listContainer, UI_TEXTS.LOADING);

    try {
        let q;
        if (loadMore && lastVisibleLog) {
            q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), startAfter(lastVisibleLog), limit(10));
        } else {
            q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(10));
        }

        const snapshot = await getDocs(q);
        if (loadMore) removeLoading(listContainer);

        if (snapshot.empty) {
            if (!loadMore) listContainer.innerHTML = `<p style="text-align:center; color:#666;">${UI_TEXTS.NO_DATA}</p>`;
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleLog = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        snapshot.forEach((d) => renderLogTimelineItem(listContainer, d.data()));

        if (loadMoreContainer) {
            if (snapshot.size === 10) {
                loadMoreContainer.innerHTML = `<button class="load-more-btn" id="load-more-btn">${UI_TEXTS.LOAD_MORE}</button>`;
                const newBtn = document.getElementById('load-more-btn');
                if (newBtn) newBtn.addEventListener('click', () => fetchLogs(true));
            } else {
                loadMoreContainer.innerHTML = '';
            }
        }
    } catch (error) {
        if (loadMore) removeLoading(listContainer);
        if (listContainer) listContainer.innerHTML = `<p class="error">${UI_TEXTS.ERROR_PREFIX}${error.message}</p>`;
    } finally {
        if (loadMore && loadMoreBtn) enableLoadMoreButton(loadMoreBtn, UI_TEXTS.LOAD_MORE);
    }
}

function renderLogTimelineItem(container, data) {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    const dateStr = formatDateTime(data.timestamp);
    let extra = '';
    if (data.targetName) extra += `<br><strong>Target:</strong> ${data.targetName}`;
    if (data.details) extra += `<br>${data.details}`;
    item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
            <div class="timeline-date">${dateStr}</div>
            <div class="timeline-text"><strong>${data.actionType}</strong> by ${data.actorName}${extra}</div>
        </div>
    `;
    container.appendChild(item);
}