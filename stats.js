import { db } from "./firebase.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUserData = null;
export const setStatsCurrentUser = (data) => currentUserData = data;

export async function renderStatsView() {
    // Security Guard
    if (!currentUserData || currentUserData.role !== 'admin') {
        document.getElementById('dashboard-container').innerHTML = '<h2>Access Denied</h2><p>You do not have permission to view this page.</p>';
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
        const usersSnap = await getDocs(collection(db, 'users'));
        const carsSnap = await getDocs(collection(db, 'cars'));
        const logsSnap = await getDocs(collection(db, 'logs'));
        const reqSnap = await getDocs(query(collection(db, 'requests'), where('status', '==', 'PENDING')));
        
        const activeUsersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', 'active')));
        const suspendedUsersSnap = await getDocs(query(collection(db, 'users'), where('status', '==', 'suspended')));

        const today = new Date(); today.setHours(0,0,0,0);
        let expiredCars = 0;
        let warningCars = 0;
        
        carsSnap.forEach(doc => {
            const data = doc.data();
            const licDiff = Math.ceil((data.licenseExpiry.toDate() - today) / (1000*60*60*24));
            const insDiff = Math.ceil((data.insuranceExpiry.toDate() - today) / (1000*60*60*24));
            const minDiff = Math.min(licDiff, insDiff);
            if (minDiff < 0) expiredCars++;
            else if (minDiff <= 15) warningCars++;
        });

        grid.innerHTML = `
            <div class="stat-card"><div class="stat-value">${usersSnap.size}</div><div class="stat-label">Total Users</div></div>
            <div class="stat-card success"><div class="stat-value">${activeUsersSnap.size}</div><div class="stat-label">Active Users</div></div>
            <div class="stat-card danger"><div class="stat-value">${suspendedUsersSnap.size}</div><div class="stat-label">Suspended Users</div></div>
            <div class="stat-card"><div class="stat-value">${carsSnap.size}</div><div class="stat-label">Total Cars</div></div>
            <div class="stat-card danger"><div class="stat-value">${expiredCars}</div><div class="stat-label">Expired Cars</div></div>
            <div class="stat-card warning"><div class="stat-value">${warningCars}</div><div class="stat-label">Expiring Soon</div></div>
            <div class="stat-card warning"><div class="stat-value">${reqSnap.size}</div><div class="stat-label">Pending Requests</div></div>
            <div class="stat-card"><div class="stat-value">${logsSnap.size}</div><div class="stat-label">Total Log Entries</div></div>
        `;
    } catch (error) {
        grid.innerHTML = `<p class="error">Error loading stats: ${error.message}</p>`;
    }
}