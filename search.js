/**
 * Search Module - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { db } from "./firebase.js";
import { collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
    isAdmin, renderAccessDenied, formatDateTime, formatCarLabel, daysUntil
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
            <input type="text" id="search-input" placeholder="Enter search term...">
            <select id="search-category">
                <option value="users">Users</option>
                <option value="cars">Cars</option>
                <option value="logs">Logs</option>
            </select>
            <button class="btn" id="search-btn">Search</button>
        </div>
        <div id="search-results" class="card-list">
            <p style="text-align:center; color:#666;">Enter a term and click Search.</p>
        </div>
        <div id="load-more-container" class="load-more-container"></div>
    `;

    document.getElementById('search-btn').addEventListener('click', () => handleSearch(false));
}

async function handleSearch(loadMore = false) {
    if (!isAdmin(currentUserData)) return;

    const input = document.getElementById('search-input').value.trim();
    const category = document.getElementById('search-category').value;
    const resultsContainer = document.getElementById('search-results');
    const loadMoreContainer = document.getElementById('load-more-container');

    if (!loadMore) {
        if (!input) {
            resultsContainer.innerHTML = '<p style="text-align:center; color:#666;">Enter a term and click Search.</p>';
            return;
        }
        currentSearchTerm = input.toLowerCase();
        currentSearchCategory = category;
        lastVisibleSearch = null;
        resultsContainer.innerHTML = '<p class="loading-text">Searching...</p>';
    }

    try {
        let q;
        const term = currentSearchTerm;
        const endTerm = term + '\uf8ff';

        if (currentSearchCategory === 'users') {
            q = query(
                collection(db, 'users'),
                where('username', '>=', term),
                where('username', '<=', endTerm),
                limit(10)
            );
        } else if (currentSearchCategory === 'cars') {
            q = query(
                collection(db, 'cars'),
                where('plateIdentifier', '>=', term),
                where('plateIdentifier', '<=', endTerm),
                limit(10)
            );
        } else if (currentSearchCategory === 'logs') {
            q = query(
                collection(db, 'logs'),
                where('details', '>=', term),
                where('details', '<=', endTerm),
                limit(10)
            );
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            if (!loadMore) {
                resultsContainer.innerHTML = '<p style="text-align:center; color:#666;">No results found.</p>';
            }
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleSearch = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) resultsContainer.innerHTML = '';

        snapshot.forEach(doc => {
            const data = doc.data();
            if (currentSearchCategory === 'users') renderUserSearchCard(doc.id, data);
            else if (currentSearchCategory === 'cars') renderCarSearchCard(doc.id, data);
            else if (currentSearchCategory === 'logs') renderLogSearchCard(doc.id, data);
        });

        if (loadMoreContainer) {
            if (snapshot.size === 10) {
                loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load More</button>';
                document.getElementById('load-more-btn').addEventListener('click', () => handleSearch(true));
            } else {
                loadMoreContainer.innerHTML = '';
            }
        }
    } catch (error) {
        resultsContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
    }
}

function renderUserSearchCard(id, data) {
    const list = document.getElementById('search-results');
    const card = document.createElement('div');
    card.className = 'card border-blue';
    card.innerHTML = `
        <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="card-title">${data.username}</span>
            <div class="card-meta"><span class="role-${data.role}">${data.role}</span></div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Email</span>
                    <span class="detail-value">${data.email}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Phone</span>
                    <span class="detail-value">${data.phone}</span>
                </div>
            </div>
        </div>
    `;
    list.appendChild(card);
}

function renderCarSearchCard(id, data) {
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
            <span class="card-title">${label}</span>
            <div class="card-meta"><span>${data.carId}</span></div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Owner</span>
                    <span class="detail-value">${data.ownerName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Current Assignee</span>
                    <span class="detail-value">${data.currentUserName || 'Unassigned'}</span>
                </div>
            </div>
        </div>
    `;
    list.appendChild(card);
}

function renderLogSearchCard(id, data) {
    const list = document.getElementById('search-results');
    const card = document.createElement('div');
    card.className = 'card border-blue';

    const dateStr = formatDateTime(data.timestamp);

    card.innerHTML = `
        <div class="card-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="card-title">${data.actionType}</span>
            <div class="card-meta"><span class="timestamp-meta">${dateStr}</span></div>
        </div>
        <div class="card-body">
            <div class="detail-list">
                <div class="detail-item">
                    <span class="detail-label">Actor</span>
                    <span class="detail-value">${data.actorName}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Target</span>
                    <span class="detail-value">${data.targetName || 'N/A'}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Details</span>
                    <span class="detail-value">${data.details || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
    list.appendChild(card);
}
