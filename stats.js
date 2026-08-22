/**
 * Stats Module - Car Management System
 * English only | Latin digits only | Production-ready
 * Updated: getCountFromServer (free on Spark), limit(100) for detail counts
 */

import { db } from "./firebase.js";
import { collection, query, where, getDocs, getCountFromServer } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { isAdmin, renderAccessDenied, daysUntil, escapeHtml } from "./utils.js";
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
        // getCountFromServer is FREE on Spark plan (does not count as reads)
        const usersCountSnap = await getCountFromServer(collection(db, 'users'));
        const carsCountSnap = await getCountFromServer(collection(db, 'cars'));
        const logsCountSnap = await getCountFromServer(collection(db, 'logs'));
        const reqCountSnap = await getCountFromServer(query(collection(db, 'requests'), where('status', '==', 'PENDING')));
        const activeUsersCountSnap = await getCountFromServer(query(collection(db, 'users'), where('status', '==', 'active')));
        const suspendedUsersCountSnap = await getCountFromServer(query(collection(db, 'users'), where('status', '==', 'suspended')));

        // For car detail stats, use limit(100) to stay within Spark limits
        const carsQ = query(collection(db, 'cars'), limit(100));
        const carsSnap = await getDocs(carsQ);

        let expiredCars = 0;
        let warningCars = 0;
        let assignedCars = 0;
        let totalCarsInSample = 0;

        carsSnap.forEach(doc => {
            const data = doc.data();
            totalCarsInSample++;
            const licDiff = daysUntil(data.licenseExpiry);
            const insDiff = daysUntil(data.insuranceExpiry);
            const minDiff = Math.min(licDiff, insDiff);
            if (minDiff < 0) expiredCars++;
            else if (minDiff <= 15) warningCars++;
            if (data.currentUserId) assignedCars++;
        });

        // Scale estimates if we hit the limit
        const totalCars = carsCountSnap.data().count;
        const scaleFactor = totalCars > 0 ? totalCars / Math.max(totalCarsInSample, 1) : 1;
        const estimatedExpired = totalCars > 100 ? Math.round(expiredCars * scaleFactor) : expiredCars;
        const estimatedWarning = totalCars > 100 ? Math.round(warningCars * scaleFactor) : warningCars;
        const estimatedAssigned = totalCars > 100 ? Math.round(assignedCars * scaleFactor) : assignedCars;

        grid.innerHTML = `
            <div class="stat-card clickable" data-nav="members" title="View all members">
                <div class="stat-value">${usersCountSnap.data().count}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-card success clickable" data-nav="members" title="View members">
                <div class="stat-value">${activeUsersCountSnap.data().count}</div>
                <div class="stat-label">Active Users</div>
            </div>
            <div class="stat-card danger clickable" data-nav="members" title="View members">
                <div class="stat-value">${suspendedUsersCountSnap.data().count}</div>
                <div class="stat-label">Suspended Users</div>
            </div>
            <div class="stat-card clickable" data-nav="cars" data-filter="all" title="View all cars">
                <div class="stat-value">${totalCars}</div>
                <div class="stat-label">Total Cars</div>
            </div>
            <div class="stat-card success clickable" data-nav="cars" data-filter="all" title="View assigned cars">
                <div class="stat-value">${estimatedAssigned}${totalCars > 100 ? '+' : ''}</div>
                <div class="stat-label">Assigned Cars</div>
            </div>
            <div class="stat-card danger clickable" data-nav="cars" data-filter="expired" title="View expired cars">
                <div class="stat-value">${estimatedExpired}${totalCars > 100 ? '+' : ''}</div>
                <div class="stat-label">Expired Cars</div>
            </div>
            <div class="stat-card warning clickable" data-nav="cars" data-filter="warning" title="View cars expiring soon">
                <div class="stat-value">${estimatedWarning}${totalCars > 100 ? '+' : ''}</div>
                <div class="stat-label">Expiring Soon</div>
            </div>
            <div class="stat-card warning clickable" data-nav="requests" title="View pending requests">
                <div class="stat-value">${reqCountSnap.data().count}</div>
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
        grid.innerHTML = '<p class="error">Error loading stats: ' + escapeHtml(error.message) + '</p>';
    }
}
