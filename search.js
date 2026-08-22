/**
 * Search Module - Car Management System
 * English only | Latin digits only | Production-ready
 * Updated: Multi-field search, debounce, abort previous, Spark-optimized, highlight
 */

import { db } from "./firebase.js";
import { collection, query, where, limit, startAfter, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    isAdmin, renderAccessDenied, formatDateTime, formatCarLabel, daysUntil,
    debounce, escapeHtml, setActiveSearchAbort, getActiveSearchAbort, clearActiveSearchAbort
} from "./utils.js";

let lastVisibleSearch = null;
let currentSearchCategory = 'users';
let currentSearchTerm = '';
let currentUserData = null;

export const setSearchCurrentUser = (data) => { currentUserData = data; };

export function renderSearchView() {
    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>System Search</h2>
        <div class="divider"></div>
        <div class="search-bar">
            <input type="text" id="search-input" placeholder="Enter search term..." aria-label="Search term" autocomplete="off">
            <select id="search-category" aria-label="Search category">
                <option value="all">All Fields</option>
                <option value="users">Users Only</option>
                <option value="cars">Cars Only</option>
                <option value="logs">Logs Only</option>
            </select>
            <button class="btn" id="search-btn">Search</button>
        </div>
        <div id="search-filters" class="search-filters" style="display:none;"></div>
        <div id="search-results" class="card-list">
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <p>Enter a term and click Search or press Enter.</p>
            </div>
        </div>
        <div id="load-more-container" class="load-more-container"></div>
    `;

    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    const categorySelect = document.getElementById('search-category');

    searchBtn.addEventListener('click', () => handleSearch(false));
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch(false);
    });
    searchInput.addEventListener('input', debounce(() => {
        const val = searchInput.value.trim();
        if (val.length >= 2) {
            handleSearch(false);
        }
    }, 400));
    categorySelect.addEventListener('change', () => {
        lastVisibleSearch = null;
        if (searchInput.value.trim().length >= 2) {
            handleSearch(false);
        }
    });
}

async function handleSearch(loadMore = false) {
    if (!isAdmin(currentUserData)) return;

    const input = document.getElementById('search-input').value.trim();
    const category = document.getElementById('search-category').value;
    const resultsContainer = document.getElementById('search-results');
    const loadMoreContainer = document.getElementById('load-more-container');

    if (!loadMore) {
        if (!input || input.length < 2) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <p>Enter at least 2 characters to search.</p>
                </div>
            `;
            return;
        }
        currentSearchTerm = input.toLowerCase();
        currentSearchCategory = category;
        lastVisibleSearch = null;
        resultsContainer.innerHTML = '<p class="loading-text">Searching...</p>';
    }

    // Abort any previous search
    const controller = new AbortController();
    setActiveSearchAbort(controller);

    try {
        let allResults = [];
        const term = currentSearchTerm;
        const endTerm = term + '\uf8ff';

        if (currentSearchCategory === 'all' || currentSearchCategory === 'users') {
            const userQ = query(
                collection(db, 'users'),
                where('username', '>=', term),
                where('username', '<=', endTerm),
                orderBy('username'),
                limit(10)
            );
            const userSnap = await getDocs(userQ);
            userSnap.forEach(doc => {
                allResults.push({ type: 'user', id: doc.id, data: doc.data() });
            });
        }

        if (currentSearchCategory === 'all' || currentSearchCategory === 'cars') {
            const carQ = query(
                collection(db, 'cars'),
                where('plateIdentifier', '>=', term),
                where('plateIdentifier', '<=', endTerm),
                orderBy('plateIdentifier'),
                limit(10)
            );
            const carSnap = await getDocs(carQ);
            carSnap.forEach(doc => {
                allResults.push({ type: 'car', id: doc.id, data: doc.data() });
            });
        }

        if (currentSearchCategory === 'all' || currentSearchCategory === 'logs') {
            const logQ = query(
                collection(db, 'logs'),
                where('details', '>=', term),
                where('details', '<=', endTerm),
                orderBy('details'),
                limit(10)
            );
            const logSnap = await getDocs(logQ);
            logSnap.forEach(doc => {
                allResults.push({ type: 'log', id: doc.id, data: doc.data() });
            });
        }

        if (controller.signal.aborted) return;
        clearActiveSearchAbort();

        if (allResults.length === 0) {
            if (!loadMore) {
                resultsContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">🔍</div>
                        <p>No results found for "${escapeHtml(currentSearchTerm)}".</p>
                    </div>
                `;
            }
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        if (!loadMore) resultsContainer.innerHTML = '';

        allResults.forEach(item => {
            if (item.type === 'user') renderUserSearchCard(item.id, item.data, currentSearchTerm);
            else if (item.type === 'car') renderCarSearchCard(item.id, item.data, currentSearchTerm);
            else if (item.type === 'log') renderLogSearchCard(item.id, item.data, currentSearchTerm);
        });

        if (loadMoreContainer) loadMoreContainer.innerHTML = '';

    } catch (error) {
        if (controller.signal.aborted) return;
        resultsContainer.innerHTML = `<p class="error">Error: ${escapeHtml(error.message)}</p>`;
    }
}

function highlightText(text, term) {
    if (!text || !term) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const regex = new RegExp(`(${escapeHtml(term)})`, 'gi');
    return escaped.replace(regex, '<span class="search-highlight">$1</span>');
}

function renderUserSearchCard(id, data, term) {
    const list = document.getElementById('search-results');
    const card = document.createElement('div');
    card.className = 'card border-blue';
    card.setAttribute('role', 'region');
    card.innerHTML = `
        <div class="card-header" tabindex="0" role="button" aria-expanded="false" onclick="this.parentElement.classList.toggle('open')">
            <span class="card-title">${highlightText(data.username, term)}</span>
            <div class="card-meta"><span class="role-${data.role}">${data.role}</span></div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${highlightText(data.email, term)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${highlightText(data.phone, term)}</span>
                </div>
            </div>
        </div>
    `;
    list.appendChild(card);
}

function renderCarSearchCard(id, data, term) {
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
        <div class="card-header" tabindex="0" role="button" aria-expanded="false" onclick="this.parentElement.classList.toggle('open')">
            <span class="card-title">${highlightText(label, term)}</span>
            <div class="card-meta"><span>${escapeHtml(data.carId)}</span></div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Owner</span>
                    <span class="detail-value">${highlightText(data.ownerName, term)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Current Assignee</span>
                    <span class="detail-value">${data.currentUserName ? highlightText(data.currentUserName, term) : 'Unassigned'}</span>
                </div>
            </div>
        </div>
    `;
    list.appendChild(card);
}

function renderLogSearchCard(id, data, term) {
    const list = document.getElementById('search-results');
    const card = document.createElement('div');
    card.className = 'card border-blue';

    const dateStr = formatDateTime(data.timestamp);

    card.innerHTML = `
        <div class="card-header" tabindex="0" role="button" aria-expanded="false" onclick="this.parentElement.classList.toggle('open')">
            <span class="card-title">${highlightText(data.actionType, term)}</span>
            <div class="card-meta"><span class="timestamp-meta">${dateStr}</span></div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Actor</span>
                    <span class="detail-value">${highlightText(data.actorName, term)}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Target</span>
                    <span class="detail-value">${data.targetName ? highlightText(data.targetName, term) : 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Details</span>
                    <span class="detail-value">${data.details ? highlightText(data.details, term) : 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
    list.appendChild(card);
}
