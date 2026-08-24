/**
 * Immutable client-side audit log helper and administrator timeline.
 */

import { db } from "./firebase.js";
import {
    collection, addDoc, query, orderBy, limit, startAfter, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    isAdmin, renderAccessDenied, formatDateTime, escapeHtml, sanitizePlainText
} from "./utils.js";

let lastVisibleLog = null;
let currentUserData = null;

export const setLogsCurrentUser = (data) => {
    currentUserData = data;
};

export async function logAction(actor, actionType, details = {}) {
    if (!actor?.uid || !actor?.username) return false;

    const entry = {
        timestamp: serverTimestamp(),
        actorId: sanitizePlainText(actor.uid, 128),
        actorName: sanitizePlainText(actor.username, 40),
        actionType: sanitizePlainText(actionType, 40),
        targetId: details.targetId ? sanitizePlainText(details.targetId, 128) : null,
        targetName: details.targetName ? sanitizePlainText(details.targetName, 160) : null,
        assigneeId: details.assigneeId ? sanitizePlainText(details.assigneeId, 128) : null,
        details: sanitizePlainText(details.text, 500)
    };

    if (!entry.actionType) return false;

    try {
        await addDoc(collection(db, 'logs'), entry);
        return true;
    } catch (error) {
        console.error('Audit log write failed:', error?.code || 'unknown');
        return false;
    }
}

export function renderLogsView() {
    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    if (!container) return;

    container.innerHTML = `
        <h2>System Logs Timeline</h2>
        <p class="section-intro">Immutable audit trail of recorded system activities.</p>
        <div class="divider"></div>
        <div id="logs-timeline" class="timeline" aria-live="polite">
            <p class="loading-text">Loading logs...</p>
        </div>
        <div id="load-more-container" class="load-more-container"></div>
    `;

    lastVisibleLog = null;
    fetchLogs(false);
}

async function fetchLogs(loadMore = false) {
    if (!isAdmin(currentUserData)) return;

    const listContainer = document.getElementById('logs-timeline');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!listContainer) return;

    if (!loadMore) listContainer.innerHTML = '<p class="loading-text">Loading logs...</p>';

    try {
        const baseQuery = [collection(db, 'logs'), orderBy('timestamp', 'desc')];
        const logQuery = loadMore && lastVisibleLog
            ? query(...baseQuery, startAfter(lastVisibleLog), limit(10))
            : query(...baseQuery, limit(10));
        const snapshot = await getDocs(logQuery);

        if (snapshot.empty) {
            if (!loadMore) listContainer.innerHTML = '<p class="empty-state">No logs found.</p>';
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleLog = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';
        snapshot.forEach(logDoc => renderLogTimelineItem(listContainer, logDoc.data()));

        if (!loadMoreContainer) return;
        if (snapshot.size === 10) {
            loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn" type="button">Load More</button>';
            document.getElementById('load-more-btn')?.addEventListener('click', () => fetchLogs(true));
        } else {
            loadMoreContainer.innerHTML = '';
        }
    } catch (error) {
        listContainer.innerHTML = '<p class="error">Unable to load logs. Please try again.</p>';
    }
}

function renderLogTimelineItem(container, data) {
    const item = document.createElement('article');
    item.className = 'timeline-item';

    const date = escapeHtml(formatDateTime(data.timestamp));
    const action = escapeHtml(data.actionType || 'Activity');
    const actor = escapeHtml(data.actorName || 'System');
    const target = data.targetName
        ? `<br><strong>Target:</strong> ${escapeHtml(data.targetName)}`
        : '';
    const details = data.details ? `<br>${escapeHtml(data.details)}` : '';

    item.innerHTML = `
        <div class="timeline-dot" aria-hidden="true"></div>
        <div class="timeline-content">
            <div class="timeline-date">${date}</div>
            <div class="timeline-text"><strong>${action}</strong> by ${actor}${target}${details}</div>
        </div>
    `;
    container.appendChild(item);
}
