/**
 * Stats Module - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { db } from "./firebase.js";
import { collection, query, where, getDocs, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { isAdmin, renderAccessDenied, daysUntil } from "./utils.js";
import { renderCarsView } from "./cars.js";
import { renderDashboard } from "./members.js";
import { renderRequestsView } from "./requests.js";
import { renderLogsView } from "./logs.js";

let currentUserData = null;
export const setStatsCurrentUser = (data) => { currentUserData = data; };

export async function renderStatsView() {
    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>System Statistics</h2>
        <div class="divider"></div>
        <div class="stats-grid" id="stats-grid">
            <p class="loading-text">Calculating stats...</p>
        </div>
    `;

    const grid = document.getElementById('stats-grid');

    try {
        const [usersSnap, carsSnap, logsCountSnap, requestsCountSnap] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'cars')),
            getCountFromServer(collection(db, 'logs')),
            getCountFromServer(query(collection(db, 'requests'), where('status', '==', 'PENDING')))
        ]);

        let activeUsers = 0;
        let suspendedUsers = 0;
        usersSnap.forEach(userDoc => {
            if (userDoc.data().status === 'active') activeUsers++;
            else if (userDoc.data().status === 'suspended') suspendedUsers++;
        });

        let expiredCars = 0;
        let warningCars = 0;
        let assignedCars = 0;

        carsSnap.forEach(doc => {
            const data = doc.data();
            const licDiff = daysUntil(data.licenseExpiry);
            const insDiff = daysUntil(data.insuranceExpiry);
            const minDiff = Math.min(licDiff, insDiff);
            if (minDiff < 0) expiredCars++;
            else if (minDiff <= 15) warningCars++;
            if (data.currentUserId) assignedCars++;
        });

        grid.innerHTML = `
            <div class="stat-card clickable" data-nav="members" title="View all members">
                <div class="stat-value">${usersSnap.size}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card success clickable" data-nav="members" title="View members">
                <div class="stat-value">${activeUsers}</div>
                <div class="stat-label">Active Users</div>
            </div>
            <div class="stat-card danger clickable" data-nav="members" title="View members">
                <div class="stat-value">${suspendedUsers}</div>
                <div class="stat-label">Suspended Users</div>
            </div>
            <div class="stat-card clickable" data-nav="cars" data-filter="all" title="View all cars">
                <div class="stat-value">${carsSnap.size}</div>
                <div class="stat-label">Total Cars</div>
            </div>
            <div class="stat-card success clickable" data-nav="cars" data-filter="assigned" title="View assigned cars">
                <div class="stat-value">${assignedCars}</div>
                <div class="stat-label">Assigned Cars</div>
            </div>
            <div class="stat-card danger clickable" data-nav="cars" data-filter="expired" title="View expired cars">
                <div class="stat-value">${expiredCars}</div>
                <div class="stat-label">Expired Cars</div>
            </div>
            <div class="stat-card warning clickable" data-nav="cars" data-filter="warning" title="View cars expiring soon">
                <div class="stat-value">${warningCars}</div>
                <div class="stat-label">Expiring Soon</div>
            </div>
            <div class="stat-card warning clickable" data-nav="requests" title="View pending requests">
                <div class="stat-value">${requestsCountSnap.data().count}</div>
                <div class="stat-label">Pending Requests</div>
            </div>
            <div class="stat-card clickable" data-nav="logs" title="View system logs">
                <div class="stat-value">${logsCountSnap.data().count}</div>
                <div class="stat-label">Total Log Entries</div>
            </div>
        `;

        grid.querySelectorAll('.stat-card.clickable').forEach(card => {
            card.style.cursor = 'pointer';
            card.addEventListener('click', () => {
                const nav = card.dataset.nav;
                const filter = card.dataset.filter || null;

                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                const tabBtn = document.querySelector('.tab-btn[data-tab="' + nav + '"]');
                if (tabBtn) tabBtn.classList.add('active');

                if (nav === 'cars') {
                    if (filter) sessionStorage.setItem('carsFilter', filter);
                    else sessionStorage.removeItem('carsFilter');
                    renderCarsView();
                } else if (nav === 'members') {
                    renderDashboard();
                } else if (nav === 'requests') {
                    renderRequestsView();
                } else if (nav === 'logs') {
                    renderLogsView();
                }
            });
        });

    } catch (error) {
        console.error('Load statistics failed:', error);
        grid.innerHTML = '<p class="error">Unable to load statistics. Please try again.</p>';
    }
}