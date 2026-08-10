import { db } from "./firebase.js";
import { 
    collection, addDoc, query, orderBy, limit, startAfter, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let lastVisibleLog = null;

export async function logAction(actor, actionType, details = {}) {
    try {
        await addDoc(collection(db, 'logs'), {
            timestamp: serverTimestamp(),
            actorId: actor.uid || 'system',
            actorName: actor.username || 'System',
            actionType: actionType,
            targetId: details.targetId || null,
            targetName: details.targetName || null,
            details: details.text || ''
        });
    } catch (error) {
        console.error("Logging failed:", error);
    }
}

export function renderLogsView() {
    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>System Logs</h2>
        <p style="text-align: center; color: #666; margin-bottom: 20px;">Immutable audit trail of all system activities.</p>
        <div class="divider"></div>
        <div id="logs-card-list" class="card-list">
            <p class="loading-text">Loading logs...</p>
        </div>
        <div id="load-more-container" class="load-more-container"></div>
    `;
    lastVisibleLog = null;
    fetchLogs(false);
}

async function fetchLogs(loadMore = false) {
    const listContainer = document.getElementById('logs-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    if (!loadMore) listContainer.innerHTML = '<p class="loading-text">Loading logs...</p>';

    try {
        let q;
        if (loadMore && lastVisibleLog) {
            q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), startAfter(lastVisibleLog), limit(10));
        } else {
            q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(10));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            if (!loadMore) listContainer.innerHTML = '<p style="text-align:center; color:#666;">No logs found.</p>';
            loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleLog = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        snapshot.forEach((d) => {
            const data = d.data();
            renderLogCard(d.id, data);
        });

        if (snapshot.size === 10) {
            loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load More</button>';
            document.getElementById('load-more-btn').addEventListener('click', () => fetchLogs(true));
        } else {
            loadMoreContainer.innerHTML = '';
        }
    } catch (error) {
        listContainer.innerHTML = `<p class="error">Error loading logs: ${error.message}</p>`;
    }
}

function renderLogCard(id, data) {
    const listContainer = document.getElementById('logs-card-list');
    const card = document.createElement('div');
    card.className = 'card';
    
    let dateStr = 'Just now';
    if (data.timestamp) {
        dateStr = new Date(data.timestamp.toDate()).toLocaleString('en-GB', {
            timeZone: 'Asia/Dubai', year: 'numeric', month: 'short', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    }

    card.innerHTML = `
        <div class="card-header" id="header-${id}">
            <span class="card-title">${data.actionType} - ${data.actorName}</span>
            <div class="card-meta"><span class="timestamp-meta">${dateStr}</span></div>
        </div>
        <div class="card-body" id="body-${id}">
            <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">Time</span><span class="detail-value">${dateStr}</span></div>
                <div class="detail-item"><span class="detail-label">Action</span><span class="detail-value action-type">${data.actionType}</span></div>
                <div class="detail-item"><span class="detail-label">Performed By</span><span class="detail-value">${data.actorName}</span></div>
                ${data.targetName ? `<div class="detail-item"><span class="detail-label">Target</span><span class="detail-value">${data.targetName}</span></div>` : ''}
                ${data.details ? `<div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">Details</span><span class="detail-value">${data.details}</span></div>` : ''}
            </div>
        </div>
    `;
    listContainer.appendChild(card);
    document.getElementById(`header-${id}`).addEventListener('click', () => card.classList.toggle('open'));
}