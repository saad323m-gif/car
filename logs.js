/**
 * Logs Module - Car Management System
 * English only | Latin digits only | Production-ready
 * Logs are immutable - no edit or delete functionality exists.
 */

import { db } from "./firebase.js";
import {
    collection, addDoc, query, orderBy, limit, startAfter, getDocs, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    showMessage, isAdmin, renderAccessDenied, formatDateTime
} from "./utils.js";

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
    } catch (error) {
        console.error('Logging failed:', error);
    }
}

export function renderLogsView() {
    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>System Logs Timeline</h2>
        <p style="text-align: center; color: #666; margin-bottom: 20px;">
            Immutable audit trail of all system activities.
        </p>
        <div class="divider"></div>
        <div id="logs-timeline" class="timeline">
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
        let q;
        if (loadMore && lastVisibleLog) {
            q = query(
                collection(db, 'logs'),
                orderBy('timestamp', 'desc'),
                startAfter(lastVisibleLog),
                limit(10)
            );
        } else {
            q = query(
                collection(db, 'logs'),
                orderBy('timestamp', 'desc'),
                limit(10)
            );
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            if (!loadMore) {
                listContainer.innerHTML = '<p style="text-align:center; color:#666;">No logs found.</p>';
            }
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleLog = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        snapshot.forEach((d) => {
            renderLogTimelineItem(listContainer, d.data());
        });

        if (loadMoreContainer) {
            if (snapshot.size === 10) {
                loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load More</button>';
                const loadMoreBtn = document.getElementById('load-more-btn');
                if (loadMoreBtn) {
                    loadMoreBtn.addEventListener('click', () => fetchLogs(true));
                }
            } else {
                loadMoreContainer.innerHTML = '';
            }
        }
    } catch (error) {
        if (listContainer) {
            listContainer.innerHTML = `<p class="error">Error loading logs: ${error.message}</p>`;
        }
    }
}

function renderLogTimelineItem(container, data) {
    const item = document.createElement('div');
    item.className = 'timeline-item';

    const dateStr = formatDateTime(data.timestamp);

    let extra = '';
    if (data.targetName) {
        extra = `<br><strong>Target:</strong> ${data.targetName}`;
    }
    if (data.details) {
        extra += `<br>${data.details}`;
    }

    item.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-content">
            <div class="timeline-date">${dateStr}</div>
            <div class="timeline-text">
                <strong>${data.actionType}</strong> by ${data.actorName}
                ${extra}
            </div>
        </div>
    `;
    container.appendChild(item);
}