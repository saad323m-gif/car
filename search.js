/**
 * Search Module - Car Management System
 * English only | Latin digits only | Production-ready
 * Improved: multi-field search, better matching, clearer results & UX
 */

import { db } from "./firebase.js";
import {
    collection, query, where, limit, getDocs, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    isAdmin, renderAccessDenied, formatDateTime, formatCarLabel,
    daysUntil, emptyStateHtml, loadingHtml
} from "./utils.js";

let currentUserData = null;
let lastResults = [];          // keep for client-side pagination of filtered set
let currentPage = 0;
const PAGE_SIZE = 12;

export const setSearchCurrentUser = (data) => { currentUserData = data; };

export function renderSearchView() {
    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>System Search</h2>
        <p class="search-hint">
            Search across users, cars or logs. You can search by name, email, phone,
            plate number, VIN, car ID, owner, action type and more.
        </p>
        <div class="divider"></div>

        <div class="search-bar">
            <input type="text" id="search-input" placeholder="Type at least 2 characters..." autocomplete="off">
            <select id="search-category">
                <option value="users">Users</option>
                <option value="cars">Cars</option>
                <option value="logs">Logs</option>
            </select>
            <button class="btn" id="search-btn">Search</button>
        </div>

        <div id="search-meta" class="search-meta" style="display:none;"></div>
        <div id="search-results" class="card-list">
            ${emptyStateHtml('Enter a term (min. 2 characters) and click Search.')}
        </div>
        <div id="load-more-container" class="load-more-container"></div>
    `;

    const input = document.getElementById('search-input');
    const btn = document.getElementById('search-btn');

    btn.addEventListener('click', () => runSearch());
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') runSearch();
    });
    // Optional: live search after 3 chars with debounce
    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const val = input.value.trim();
        if (val.length >= 3) {
            debounceTimer = setTimeout(() => runSearch(), 450);
        }
    });
}

async function runSearch() {
    if (!isAdmin(currentUserData)) return;

    const inputEl = document.getElementById('search-input');
    const categoryEl = document.getElementById('search-category');
    const resultsContainer = document.getElementById('search-results');
    const metaEl = document.getElementById('search-meta');
    const loadMoreContainer = document.getElementById('load-more-container');

    const raw = (inputEl?.value || '').trim();
    const category = categoryEl?.value || 'users';

    if (raw.length < 2) {
        resultsContainer.innerHTML = emptyStateHtml('Please enter at least 2 characters to search.');
        metaEl.style.display = 'none';
        loadMoreContainer.innerHTML = '';
        return;
    }

    resultsContainer.innerHTML = loadingHtml('Searching...');
    metaEl.style.display = 'none';
    loadMoreContainer.innerHTML = '';
    currentPage = 0;
    lastResults = [];

    const term = raw.toLowerCase();

    try {
        let results = [];

        if (category === 'users') {
            results = await searchUsers(term);
        } else if (category === 'cars') {
            results = await searchCars(term);
        } else {
            results = await searchLogs(term);
        }

        lastResults = results;

        if (results.length === 0) {
            resultsContainer.innerHTML = emptyStateHtml(
                `No results found for “${raw}” in ${category}. Try a different term or category.`
            );
            return;
        }

        metaEl.style.display = 'block';
        metaEl.innerHTML = `<strong>${results.length}</strong> result${results.length === 1 ? '' : 's'} found for “${escapeHtml(raw)}”`;

        renderPage();
    } catch (error) {
        console.error('Search failed:', error);
        resultsContainer.innerHTML = '<p class="error">Unable to complete the search. Please try again.</p>';
    }
}

function renderPage() {
    const resultsContainer = document.getElementById('search-results');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!resultsContainer) return;

    const start = currentPage * PAGE_SIZE;
    const slice = lastResults.slice(start, start + PAGE_SIZE);

    if (currentPage === 0) resultsContainer.innerHTML = '';

    slice.forEach(item => {
        if (item._type === 'user') renderUserCard(item);
        else if (item._type === 'car') renderCarCard(item);
        else renderLogCard(item);
    });

    const remaining = lastResults.length - (start + slice.length);
    if (remaining > 0) {
        loadMoreContainer.innerHTML = `
            <button class="load-more-btn" id="search-load-more">
                Load More (${remaining} remaining)
            </button>`;
        document.getElementById('search-load-more').addEventListener('click', () => {
            currentPage++;
            renderPage();
        });
    } else {
        loadMoreContainer.innerHTML = '';
    }
}

/* -------------------- Search implementations -------------------- */

async function searchUsers(term) {
    // Fetch a reasonable batch ordered by username then filter client-side.
    // This works well for typical fleet sizes and allows multi-field matching.
    const q = query(collection(db, 'users'), orderBy('username'), limit(200));
    const snap = await getDocs(q);
    const results = [];

    snap.forEach(doc => {
        const d = doc.data();
        const haystack = [
            d.username, d.email, d.phone, d.notes, d.role, d.status
        ].map(v => String(v || '').toLowerCase()).join(' ');

        if (haystack.includes(term)) {
            results.push({ ...d, id: doc.id, _type: 'user', _match: detectUserMatch(d, term) });
        }
    });

    // Prefer exact / prefix matches first
    results.sort((a, b) => scoreMatch(a, term) - scoreMatch(b, term));
    return results;
}

async function searchCars(term) {
    const q = query(collection(db, 'cars'), orderBy('licenseExpiry', 'asc'), limit(250));
    const snap = await getDocs(q);
    const results = [];

    snap.forEach(doc => {
        const d = doc.data();
        const haystack = [
            d.carId, d.plateNumber, d.plateCode, d.emirate,
            d.type, d.ownerName, d.vin, d.notes, d.currentUserName,
            d.plateIdentifier
        ].map(v => String(v || '').toLowerCase()).join(' ');

        if (haystack.includes(term)) {
            results.push({ ...d, id: doc.id, _type: 'car', _match: detectCarMatch(d, term) });
        }
    });

    results.sort((a, b) => scoreMatch(a, term) - scoreMatch(b, term));
    return results;
}

async function searchLogs(term) {
    // Logs can grow large; we take the most recent 300 and filter.
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(300));
    const snap = await getDocs(q);
    const results = [];

    snap.forEach(doc => {
        const d = doc.data();
        const haystack = [
            d.actionType, d.actorName, d.targetName, d.details, d.targetId
        ].map(v => String(v || '').toLowerCase()).join(' ');

        if (haystack.includes(term)) {
            results.push({ ...d, id: doc.id, _type: 'log', _match: detectLogMatch(d, term) });
        }
    });

    return results; // already newest-first
}

/* -------------------- Match helpers -------------------- */

function detectUserMatch(d, term) {
    if (String(d.username || '').toLowerCase().includes(term)) return 'Username';
    if (String(d.email || '').toLowerCase().includes(term)) return 'Email';
    if (String(d.phone || '').toLowerCase().includes(term)) return 'Phone';
    if (String(d.notes || '').toLowerCase().includes(term)) return 'Notes';
    return 'Profile';
}

function detectCarMatch(d, term) {
    if (String(d.carId || '').toLowerCase().includes(term)) return 'Car ID';
    if (String(d.plateNumber || '').toLowerCase().includes(term)) return 'Plate Number';
    if (String(d.plateCode || '').toLowerCase().includes(term)) return 'Plate Code';
    if (String(d.vin || '').toLowerCase().includes(term)) return 'VIN';
    if (String(d.ownerName || '').toLowerCase().includes(term)) return 'Owner';
    if (String(d.type || '').toLowerCase().includes(term)) return 'Type';
    if (String(d.currentUserName || '').toLowerCase().includes(term)) return 'Assignee';
    if (String(d.emirate || '').toLowerCase().includes(term)) return 'Emirate';
    return 'Car data';
}

function detectLogMatch(d, term) {
    if (String(d.actionType || '').toLowerCase().includes(term)) return 'Action';
    if (String(d.actorName || '').toLowerCase().includes(term)) return 'Actor';
    if (String(d.targetName || '').toLowerCase().includes(term)) return 'Target';
    if (String(d.details || '').toLowerCase().includes(term)) return 'Details';
    return 'Log';
}

function scoreMatch(item, term) {
    // Lower score = better (shown first)
    const primary = (item.username || item.carId || item.actionType || '').toLowerCase();
    if (primary === term) return 0;
    if (primary.startsWith(term)) return 1;
    if (primary.includes(term)) return 2;
    return 3;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* -------------------- Result cards -------------------- */

function renderUserCard(data) {
    const list = document.getElementById('search-results');
    const card = document.createElement('div');
    card.className = 'card border-blue';
    card.innerHTML = `
        <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="card-title">${escapeHtml(data.username)}</span>
            <div class="card-meta">
                <span class="role-${escapeHtml(data.role)}">${escapeHtml(data.role)}</span>
                <span class="status-${escapeHtml(data.status)}">${escapeHtml(data.status)}</span>
                <span class="match-badge">Matched: ${escapeHtml(data._match)}</span>
            </div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${escapeHtml(data.email || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${escapeHtml(data.phone || 'N/A')}</span>
                </div>
                ${data.notes ? `
                <div class="detail-item">
                    <span class="detail-label">Notes</span>
                    <span class="detail-value">${escapeHtml(data.notes)}</span>
                </div>` : ''}
            </div>
        </div>
    `;
    list.appendChild(card);
}

function renderCarCard(data) {
    const list = document.getElementById('search-results');
    const card = document.createElement('div');
    card.className = 'card border-blue';

    const minDiff = Math.min(
        daysUntil(data.licenseExpiry),
        daysUntil(data.insuranceExpiry)
    );
    if (minDiff < 0) card.classList.add('border-red');
    else if (minDiff <= 15) card.classList.add('border-yellow');

    const label = formatCarLabel(data);

    card.innerHTML = `
        <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="card-title">${escapeHtml(label)}</span>
            <div class="card-meta">
                <span>${escapeHtml(data.carId || '')}</span>
                <span class="match-badge">Matched: ${escapeHtml(data._match)}</span>
            </div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Owner</span>
                    <span class="detail-value">${escapeHtml(data.ownerName || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">${escapeHtml(data.type || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">VIN</span>
                    <span class="detail-value">${escapeHtml(data.vin || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Current Assignee</span>
                    <span class="detail-value">${escapeHtml(data.currentUserName || 'Unassigned')}</span>
                </div>
            </div>
        </div>
    `;
    list.appendChild(card);
}

function renderLogCard(data) {
    const list = document.getElementById('search-results');
    const card = document.createElement('div');
    card.className = 'card border-blue';
    const dateStr = formatDateTime(data.timestamp);

    card.innerHTML = `
        <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="card-title">${escapeHtml(data.actionType || 'Action')}</span>
            <div class="card-meta">
                <span class="timestamp-meta">${escapeHtml(dateStr)}</span>
                <span class="match-badge">Matched: ${escapeHtml(data._match)}</span>
            </div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Actor</span>
                    <span class="detail-value">${escapeHtml(data.actorName || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Target</span>
                    <span class="detail-value">${escapeHtml(data.targetName || 'N/A')}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Details</span>
                    <span class="detail-value">${escapeHtml(data.details || 'N/A')}</span>
                </div>
            </div>
        </div>
    `;
    list.appendChild(card);
}
