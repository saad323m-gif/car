/**
 * Members Module - Car Management System
 * English only | Latin digits only | Production-ready
 */

import { auth, db, firebaseConfig } from "./firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, doc, setDoc, getDoc, getDocs, updateDoc,
    query, where, limit, startAfter
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import { showDashboardMessage } from "./messageManager.js";
import { setLoading, appendLoading, removeLoading, disableLoadMoreButton, enableLoadMoreButton, UI_TEXTS } from "./loadingManager.js";
import {
    handleFirebaseError, isAdmin, isActiveUser,
    renderAccessDenied, formatDateTime, formatPeriod
} from "./utils.js";

let currentUserData = null;
let lastVisibleUser = null;

export const setCurrentUser = (data) => { currentUserData = data; };
export const getCurrentUser = () => currentUserData;

export function renderDashboard() {
    if (!isAdmin(currentUserData)) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <div class="dashboard-header">
            <h2>Admin Dashboard</h2>
            <p style="text-align:center;">Welcome, <strong>${currentUserData.username}</strong></p>
            <button class="btn btn-sm btn-warning" id="edit-profile-btn" style="margin-top: 10px;">Edit My Profile</button>
        </div>
        <div class="divider"></div>
        <button class="btn-add-toggle" id="toggle-add-member">+ Add New Member</button>
        <div id="add-member-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
            <form id="add-user-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group"><label>Username</label><input type="text" id="new-username" required></div>
                <div class="form-group"><label>Email</label><input type="email" id="new-email" required></div>
                <div class="form-group"><label>Password</label><input type="password" id="new-password" required minlength="6"></div>
                <div class="form-group"><label>Phone</label><input type="text" id="new-phone" required pattern="0\\d{9}" placeholder="0XXXXXXXXX"></div>
                <div class="form-group" style="grid-column: 1 / -1;"><label>Role</label><select id="new-role"><option value="user">User</option><option value="admin">Admin</option></select></div>
                <div class="form-group" style="grid-column: 1 / -1;"><button type="submit" class="btn">Add Member</button></div>
            </form>
        </div>
        <h3>Members Management</h3>
        <div id="users-card-list" class="card-list"></div>
        <div id="load-more-container" class="load-more-container"></div>
    `;

    const toggleAddMember = document.getElementById('toggle-add-member');
    const addUserForm = document.getElementById('add-user-form');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (toggleAddMember) toggleAddMember.addEventListener('click', () => {
        const wrapper = document.getElementById('add-member-form-wrapper');
        if (wrapper) wrapper.classList.toggle('hidden-form');
    });
    if (addUserForm) addUserForm.addEventListener('submit', handleAddUser);
    if (editProfileBtn) editProfileBtn.addEventListener('click', renderEditProfileForm);

    lastVisibleUser = null;
    fetchUsersForAdmin(false);
}

async function handleAddUser(e) {
    e.preventDefault();
    if (!isAdmin(currentUserData)) return;
    const username = document.getElementById('new-username').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const phone = document.getElementById('new-phone').value.trim();
    const role = document.getElementById('new-role').value;

    if (!/^0\d{9}$/.test(phone)) {
        showDashboardMessage('Error: Phone must start with 0 and be exactly 10 digits.', 'error');
        return;
    }

    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) { showDashboardMessage('Error: Username already exists.', 'error'); return; }

        const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, 'users', uid), {
            username, email, phone, role, status: 'active',
            notes: '', isProtected: false, securityPin: null, rememberSession: false
        });
        await secondaryAuth.signOut();
        await logAction(currentUserData, 'CREATE_USER', { targetId: uid, targetName: username, text: `Created new ${role}: ${username}` });
        showDashboardMessage('Success: Member added successfully.', 'success');
        document.getElementById('add-user-form').reset();
        document.getElementById('add-member-form-wrapper').classList.add('hidden-form');
        lastVisibleUser = null;
        fetchUsersForAdmin(false);
    } catch (error) { handleFirebaseError(error); }
}

async function fetchUsersForAdmin(loadMore = false) {
    if (!isAdmin(currentUserData)) return;
    const listContainer = document.getElementById('users-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (!listContainer) return;

    if (loadMore && loadMoreBtn) disableLoadMoreButton(loadMoreBtn);
    if (!loadMore) setLoading(listContainer, UI_TEXTS.LOADING);
    else appendLoading(listContainer, UI_TEXTS.LOADING);

    try {
        let q;
        if (loadMore && lastVisibleUser) q = query(collection(db, 'users'), startAfter(lastVisibleUser), limit(10));
        else q = query(collection(db, 'users'), limit(10));

        const snapshot = await getDocs(q);
        if (loadMore) removeLoading(listContainer);

        if (snapshot.empty) {
            if (!loadMore) listContainer.innerHTML = `<p style="text-align:center; color:#666;">${UI_TEXTS.NO_DATA}</p>`;
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleUser = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        await Promise.all(snapshot.docs.map((d) => renderUserCard(d.id, d.data())));

        if (loadMoreContainer) {
            if (snapshot.size === 10) {
                loadMoreContainer.innerHTML = `<button class="load-more-btn" id="load-more-btn">${UI_TEXTS.LOAD_MORE}</button>`;
                const newBtn = document.getElementById('load-more-btn');
                if (newBtn) newBtn.addEventListener('click', () => fetchUsersForAdmin(true));
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

async function renderUserCard(uid, data) {
    const listContainer = document.getElementById('users-card-list');
    if (!listContainer) return;

    const card = document.createElement('div');
    card.className = 'card border-blue';
    card.id = `card-${uid}`;

    let actionsHtml = '';
    if (!data.isProtected) {
        actionsHtml = `
            <div class="action-buttons" id="member-actions-${uid}">
                <button type="button" class="action-btn action-btn-edit" data-action="edit">✎ Edit</button>
                <button type="button" class="action-btn action-btn-activity" data-action="activity">📋 Activity</button>
                ${data.role === 'user' ? '<button type="button" class="action-btn action-btn-promote" data-action="promote">↑ Promote</button>' : '<button type="button" class="action-btn action-btn-demote" data-action="demote">↓ Demote</button>'}
                ${data.status === 'active' ? '<button type="button" class="action-btn action-btn-suspend" data-action="suspend">⏸ Suspend</button>' : '<button type="button" class="action-btn action-btn-activate" data-action="activate">▶ Activate</button>'}
            </div>
            <div id="activity-area-${uid}" style="margin-top: 15px; display: none;"></div>
        `;
    } else {
        actionsHtml = `
            <div class="action-buttons" id="member-actions-${uid}">
                <button type="button" class="action-btn action-btn-activity" data-action="activity">📋 Activity</button>
            </div>
            <div id="activity-area-${uid}" style="margin-top: 15px; display: none;"></div>
        `;
    }

    let plateItems = [];
    let miniPlatesHtml = '<span class="no-cars-label">No cars assigned</span>';
    let headerPlatesHtml = '<span class="no-cars-label">No cars</span>';
    try {
        const carsQ = query(collection(db, 'cars'), where('currentUserId', '==', uid));
        const carsSnap = await getDocs(carsQ);
        if (!carsSnap.empty) {
            carsSnap.forEach(d => {
                const c = d.data();
                plateItems.push(`
                    <div class="mini-plate" title="${c.carId || ''}">
                        <span class="mini-plate-emirate">${c.emirate || ''}</span>
                        <span class="mini-plate-number">${c.plateNumber || ''}</span>
                        <span class="mini-plate-code">${c.plateCode || ''}</span>
                    </div>
                `);
            });
            miniPlatesHtml = `<div class="mini-plates-container">${plateItems.join('')}</div>`;
            if (plateItems.length === 1) {
                headerPlatesHtml = `<div class="mini-plates-container">${plateItems[0]}</div>`;
            } else {
                headerPlatesHtml = `
                    <div class="mini-plates-container" id="header-plates-visible-${uid}">${plateItems[0]}</div>
                    <div class="mini-plates-container" id="header-plates-extra-${uid}" style="display:none;">${plateItems.slice(1).join('')}</div>
                    <button type="button" class="show-more-plates-btn" id="show-more-plates-${uid}">Show more (${plateItems.length - 1})</button>
                `;
            }
        }
    } catch (_) {}

    card.innerHTML = `
        <div class="card-header" id="header-${uid}">
            <div class="card-header-top">
                <span class="card-title">${data.username}</span>
                <div class="card-meta">
                    <span class="role-${data.role}">${data.role}</span>
                    <span class="status-${data.status}">${data.status}</span>
                </div>
            </div>
            <div class="card-header-plates" id="header-plates-${uid}">${headerPlatesHtml}</div>
        </div>
        <div class="card-body" id="body-${uid}">
            <div id="view-info-${uid}">
                <div class="detail-list">
                    <div class="detail-item"><span class="detail-label">Email</span><span class="detail-value">${data.email}</span></div>
                    <div class="detail-item"><span class="detail-label">Phone</span><span class="detail-value">${data.phone}</span></div>
                    <div class="detail-item"><span class="detail-label">Notes</span><span class="detail-value">${data.notes || 'N/A'}</span></div>
                    <div class="detail-item"><span class="detail-label">Assigned Cars</span><span class="detail-value">${miniPlatesHtml}</span></div>
                </div>
                <div style="margin-top: 15px;">${actionsHtml}</div>
            </div>
            <div id="edit-form-${uid}" style="display:none;"></div>
        </div>
    `;
    listContainer.appendChild(card);

    const headerEl = card.querySelector(`#header-${uid}`);
    if (headerEl) {
        headerEl.addEventListener('click', (e) => {
            if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                card.classList.toggle('open');
            }
        });
    }

    const actionsWrap = card.querySelector(`#member-actions-${uid}`);
    if (actionsWrap) {
        actionsWrap.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleMemberAction(uid, btn.getAttribute('data-action'), data.username);
            });
        });
    }

    const showMoreBtn = card.querySelector(`#show-more-plates-${uid}`);
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const extra = card.querySelector(`#header-plates-extra-${uid}`);
            if (!extra) return;
            const isHidden = extra.style.display === 'none' || !extra.style.display;
            if (isHidden) { extra.style.display = 'flex'; showMoreBtn.textContent = 'Show less'; }
            else { extra.style.display = 'none'; showMoreBtn.textContent = `Show more (${plateItems.length - 1})`; }
        });
    }
}

async function handleMemberAction(uid, action, username) {
    if (!isAdmin(currentUserData) || !action) return;
    const activityArea = document.getElementById(`activity-area-${uid}`);
    if (activityArea) activityArea.style.display = 'none';

    try {
        if (action === 'promote') {
            await updateDoc(doc(db, 'users', uid), { role: 'admin' });
            await logAction(currentUserData, 'PROMOTE_USER', { targetId: uid, targetName: username, text: `Promoted ${username}` });
        } else if (action === 'demote') {
            await updateDoc(doc(db, 'users', uid), { role: 'user' });
            await logAction(currentUserData, 'DEMOTE_USER', { targetId: uid, targetName: username, text: `Demoted ${username}` });
        } else if (action === 'suspend') {
            await updateDoc(doc(db, 'users', uid), { status: 'suspended' });
            await logAction(currentUserData, 'SUSPEND_USER', { targetId: uid, targetName: username, text: `Suspended ${username}` });
        } else if (action === 'activate') {
            await updateDoc(doc(db, 'users', uid), { status: 'active' });
            await logAction(currentUserData, 'ACTIVATE_USER', { targetId: uid, targetName: username, text: `Activated ${username}` });
        } else if (action === 'edit') { renderInlineEditForm(uid); return; }
        else if (action === 'activity') { await renderUserActivity(uid); return; }

        showDashboardMessage(`Action completed for ${username}.`, 'success');
        lastVisibleUser = null;
        fetchUsersForAdmin(false);
    } catch (error) { handleFirebaseError(error); }
}

async function renderUserActivity(uid) {
    const activityArea = document.getElementById(`activity-area-${uid}`);
    if (!activityArea) return;
    activityArea.style.display = 'block';
    activityArea.innerHTML = '<p class="loading-text" style="font-size: 0.85rem;">Loading activity...</p>';

    try {
        const actorQ = query(collection(db, 'logs'), where('actorId', '==', uid), limit(20));
        const assigneeQ = query(collection(db, 'logs'), where('assigneeId', '==', uid), limit(20));
        const actorSnap = await getDocs(actorQ);
        const assigneeSnap = await getDocs(assigneeQ);

        const logs = [];
        actorSnap.forEach(d => logs.push(d.data()));
        assigneeSnap.forEach(d => logs.push(d.data()));
        logs.sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const tB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return tB - tA;
        });

        if (logs.length === 0) {
            activityArea.innerHTML = '<p style="font-size:0.85rem; text-align:center; color:#666;">No activity recorded.</p>';
            return;
        }

        let html = '<div class="timeline">';
        logs.slice(0, 15).forEach(log => {
            const dateStr = formatDateTime(log.timestamp);
            let itemClass = 'timeline-item';
            let text = log.details || '';
            if (log.actionType === 'CAR_ASSIGN' || log.actionType === 'AUTO_LINK') {
                itemClass += ' ongoing';
                text = `Assigned car <strong>${log.targetName || log.targetId}</strong>`;
            } else if (log.actionType === 'CAR_UNASSIGN' || log.actionType === 'APPROVE_UNLINK') {
                itemClass += ' completed';
                text = `Unassigned car <strong>${log.targetName || log.targetId}</strong>`;
            } else if (log.actionType === 'LOGIN') text = 'Logged into the system';
            else if (log.actionType === 'LOGOUT') text = 'Logged out';

            html += `<div class="${itemClass}"><div class="timeline-dot"></div><div class="timeline-content"><div class="timeline-date">${dateStr}</div><div class="timeline-text">${text}</div></div></div>`;
        });
        html += '</div>';
        activityArea.innerHTML = html;
    } catch (error) {
        activityArea.innerHTML = `<p class="error" style="font-size:0.85rem;">${UI_TEXTS.ERROR_PREFIX}${error.message}</p>`;
    }
}

async function renderInlineEditForm(uid) {
    if (!isAdmin(currentUserData)) return;
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return;
    const data = userDoc.data();

    const viewInfo = document.getElementById(`view-info-${uid}`);
    const editArea = document.getElementById(`edit-form-${uid}`);
    if (!editArea) return;
    if (viewInfo) viewInfo.style.display = 'none';
    editArea.style.display = 'block';
    editArea.innerHTML = `
        <form id="form-edit-${uid}" class="inline-edit-form">
            <div class="form-group"><label>Username</label><input type="text" id="edit-un-${uid}" value="${data.username}" required></div>
            <div class="form-group"><label>Email</label><input type="email" id="edit-em-${uid}" value="${data.email}" required></div>
            <div class="form-group"><label>Phone</label><input type="text" id="edit-ph-${uid}" value="${data.phone}" required pattern="0\\d{9}"></div>
            <div class="form-group"><label>Notes (Admin only)</label><input type="text" id="edit-nt-${uid}" value="${data.notes || ''}"></div>
            <div class="form-group full-width" style="display:flex; gap:10px;">
                <button type="submit" class="btn btn-sm">Save Changes</button>
                <button type="button" class="btn btn-sm btn-secondary" id="cancel-edit-${uid}">Cancel</button>
            </div>
        </form>
    `;

    const formEdit = document.getElementById(`form-edit-${uid}`);
    if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newUsername = document.getElementById(`edit-un-${uid}`).value.trim();
            const newEmail = document.getElementById(`edit-em-${uid}`).value.trim();
            const newPhone = document.getElementById(`edit-ph-${uid}`).value.trim();
            const newNotes = document.getElementById(`edit-nt-${uid}`).value.trim();
            if (!/^0\d{9}$/.test(newPhone)) { showDashboardMessage('Error: Phone must be 10 digits starting with 0.', 'error'); return; }
            try {
                await updateDoc(doc(db, 'users', uid), { username: newUsername, email: newEmail, phone: newPhone, notes: newNotes });
                await logAction(currentUserData, 'EDIT_USER', { targetId: uid, targetName: newUsername, text: `Edited details for ${newUsername}` });
                showDashboardMessage('Member updated successfully.', 'success');
                lastVisibleUser = null;
                fetchUsersForAdmin(false);
            } catch (err) { handleFirebaseError(err); }
        });
    }

    const cancelEditBtn = document.getElementById(`cancel-edit-${uid}`);
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            editArea.style.display = 'none';
            const vi = document.getElementById(`view-info-${uid}`);
            if (vi) vi.style.display = 'block';
        });
    }
}

function renderEditProfileForm() {
    if (!currentUserData || !currentUserData.isProtected) {
        showDashboardMessage('Only Super Admin can use this secure edit feature.', 'warning');
        return;
    }

    const container = document.getElementById('dashboard-container');
    if (!container) return;
    container.innerHTML = `
        <h2>Edit Protected Profile</h2>
        <p style="color: #666; margin-bottom: 20px; text-align:center;">Two-step verification required.</p>
        <form id="edit-profile-form" style="max-width: 500px; margin: 0 auto;">
            <div class="form-group"><label>Current Password</label><input type="password" id="verify-password" required autocomplete="current-password"></div>
            <div class="form-group"><label>Current Security PIN (4 digits)</label><input type="password" id="verify-pin" required pattern="\\d{4}" inputmode="numeric" maxlength="4"></div>
            <div class="divider"></div>
            <div class="form-group"><label>New Username</label><input type="text" id="edit-username" value="${currentUserData.username}" required></div>
            <div class="form-group"><label>New Phone</label><input type="text" id="edit-phone" value="${currentUserData.phone}" required pattern="0\\d{9}"></div>
            <div class="divider"></div>
            <p style="color:#666; font-size:0.9rem; margin-bottom:12px; text-align:center;">Leave New PIN fields empty if you do not want to change the PIN.</p>
            <div class="form-group"><label>New Security PIN (4 digits, optional)</label><input type="password" id="edit-new-pin" pattern="\\d{4}" inputmode="numeric" maxlength="4" placeholder="Leave blank to keep current"></div>
            <div class="form-group"><label>Confirm New Security PIN</label><input type="password" id="edit-confirm-pin" pattern="\\d{4}" inputmode="numeric" maxlength="4" placeholder="Leave blank to keep current"></div>
            <button type="submit" class="btn">Verify & Update</button>
            <button type="button" class="btn btn-secondary" id="cancel-edit" style="margin-top:10px;">Cancel</button>
        </form>
    `;

    const editProfileForm = document.getElementById('edit-profile-form');
    const cancelEdit = document.getElementById('cancel-edit');
    if (editProfileForm) editProfileForm.addEventListener('submit', handleEditProtectedProfile);
    if (cancelEdit) cancelEdit.addEventListener('click', renderDashboard);
}

async function handleEditProtectedProfile(e) {
    e.preventDefault();
    if (!currentUserData.isProtected) return;

    const password = document.getElementById('verify-password').value;
    const pin = document.getElementById('verify-pin').value;
    const newUsername = document.getElementById('edit-username').value.trim();
    const newPhone = document.getElementById('edit-phone').value.trim();
    const newPin = document.getElementById('edit-new-pin').value.trim();
    const confirmPin = document.getElementById('edit-confirm-pin').value.trim();

    if (pin !== currentUserData.securityPin) {
        showDashboardMessage('Security Error: Invalid Security PIN.', 'error');
        return;
    }
    if (!/^0\d{9}$/.test(newPhone)) {
        showDashboardMessage('Error: Phone must start with 0 and be 10 digits.', 'error');
        return;
    }

    if (newPin || confirmPin) {
        if (!/^\d{4}$/.test(newPin)) { showDashboardMessage('Error: New Security PIN must be exactly 4 digits.', 'error'); return; }
        if (newPin !== confirmPin) { showDashboardMessage('Error: New PIN and confirmation do not match.', 'error'); return; }
        if (newPin === pin) { showDashboardMessage('Error: New PIN must be different from the current PIN.', 'error'); return; }
    }

    try {
        const { reauthenticateWithCredential, EmailAuthProvider } = await import(
            'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js'
        );
        const credential = EmailAuthProvider.credential(currentUserData.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);

        if (newUsername !== currentUserData.username) {
            const q = query(collection(db, 'users'), where('username', '==', newUsername));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) { showDashboardMessage('Error: Username already exists.', 'error'); return; }
        }

        const updates = { username: newUsername, phone: newPhone };
        if (newPin) updates.securityPin = newPin;

        await updateDoc(doc(db, 'users', currentUserData.uid), updates);
        await logAction(currentUserData, 'EDIT_SELF_PROFILE', {
            targetId: currentUserData.uid,
            targetName: newUsername,
            text: newPin ? 'Super Admin updated own profile and security PIN' : 'Super Admin updated own profile'
        });
        showDashboardMessage('Profile updated. Reloading...', 'success');
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) { handleFirebaseError(error); }
}