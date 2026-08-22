/**
 * Members Module - Car Management System
 * English only | Latin digits only | Production-ready
 * Updated: Validators, loading states, confirm dialogs, ARIA, keyboard nav
 */

import { auth, db, firebaseConfig } from "./firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection, doc, setDoc, getDoc, getDocs, updateDoc,
    query, where, limit, startAfter, orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";
import {
    showMessage, handleFirebaseError, isAdmin, isActiveUser,
    renderAccessDenied, formatDateTime, formatPeriod,
    validators, renderConfirmDialog, sanitizeInput, containsNonEnglishDigits, setButtonLoading, resetButtonLoading, escapeHtml
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
            <p style="text-align:center;">Welcome, <strong>${escapeHtml(currentUserData.username)}</strong></p>
            <button class="btn btn-sm btn-warning" id="edit-profile-btn" style="margin-top: 10px;">Edit My Profile</button>
        </div>
        <div class="divider"></div>
        <button class="btn-add-toggle" id="toggle-add-member" aria-expanded="false" aria-controls="add-member-form-wrapper">+ Add New Member</button>
        <div id="add-member-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
            <form id="add-user-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                    <label for="new-username">Username</label>
                    <input type="text" id="new-username" required autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="new-email">Email</label>
                    <input type="email" id="new-email" required autocomplete="off">
                </div>
                <div class="form-group">
                    <label for="new-password">Password</label>
                    <input type="password" id="new-password" required minlength="6" autocomplete="new-password">
                </div>
                <div class="form-group">
                    <label for="new-phone">Phone</label>
                    <input type="text" id="new-phone" required pattern="0\d{9}" placeholder="0XXXXXXXXX" autocomplete="off">
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label for="new-role">Role</label>
                    <select id="new-role">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <button type="submit" class="btn" id="btn-add-member">Add Member</button>
                </div>
            </form>
        </div>
        <h3>Members Management</h3>
        <div id="users-card-list" class="card-list">
            <p class="loading-text">Loading members...</p>
        </div>
        <div id="load-more-container" class="load-more-container"></div>
    `;

    const toggleAddMember = document.getElementById('toggle-add-member');
    const addUserForm = document.getElementById('add-user-form');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (toggleAddMember) {
        toggleAddMember.addEventListener('click', () => {
            const wrapper = document.getElementById('add-member-form-wrapper');
            if (wrapper) {
                wrapper.classList.toggle('hidden-form');
                const expanded = !wrapper.classList.contains('hidden-form');
                toggleAddMember.setAttribute('aria-expanded', expanded);
            }
        });
    }
    if (addUserForm) {
        addUserForm.addEventListener('submit', handleAddUser);
    }
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', renderEditProfileForm);
    }

    lastVisibleUser = null;
    fetchUsersForAdmin(false);
}

async function handleAddUser(e) {
    e.preventDefault();
    if (!isAdmin(currentUserData)) return;

    const usernameEl = document.getElementById('new-username');
    const emailEl = document.getElementById('new-email');
    const passwordEl = document.getElementById('new-password');
    const phoneEl = document.getElementById('new-phone');
    const roleEl = document.getElementById('new-role');
    if (!usernameEl || !emailEl || !passwordEl || !phoneEl || !roleEl) {
        showMessage('Error: Form elements not found.', 'error', 'dashboard');
        return;
    }

    const username = usernameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    const phone = sanitizeInput('new-phone');
    const role = roleEl.value;

    if (containsNonEnglishDigits(phone)) {
        showMessage('Error: Only English digits (0-9) are allowed. Arabic digits are not accepted.', 'error', 'dashboard');
        return;
    }
    if (!validators.phone(phone)) {
        showMessage('Error: Phone must start with 0 and be exactly 10 digits.', 'error', 'dashboard');
        return;
    }
    if (!validators.password(password)) {
        showMessage('Error: Password must be at least 6 characters.', 'error', 'dashboard');
        return;
    }

    setButtonLoading('btn-add-member', 'Adding...');

    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            showMessage('Error: Username already exists.', 'error', 'dashboard');
            resetButtonLoading('btn-add-member');
            return;
        }

        const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, 'users', uid), {
            username,
            email,
            phone,
            role,
            status: 'active',
            notes: '',
            isProtected: false,
            securityPin: null,
            rememberSession: false
        });

        await secondaryAuth.signOut();

        await logAction(currentUserData, 'CREATE_USER', {
            targetId: uid,
            targetName: username,
            text: `Created new ${role}: ${username}`
        });

        showMessage('Success: Member added successfully.', 'success', 'dashboard');
        const addForm = document.getElementById('add-user-form');
        if (addForm) addForm.reset();
        const addWrapper = document.getElementById('add-member-form-wrapper');
        if (addWrapper) {
            addWrapper.classList.add('hidden-form');
            const toggle = document.getElementById('toggle-add-member');
            if (toggle) toggle.setAttribute('aria-expanded', 'false');
        }
        lastVisibleUser = null;
        fetchUsersForAdmin(false);
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    } finally {
        resetButtonLoading('btn-add-member');
    }
}

async function fetchUsersForAdmin(loadMore = false) {
    if (!isAdmin(currentUserData)) return;

    const listContainer = document.getElementById('users-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!listContainer) return;

    if (!loadMore) listContainer.innerHTML = '<p class="loading-text">Loading members...</p>';

    try {
        let q;
        if (loadMore && lastVisibleUser) {
            q = query(collection(db, 'users'), orderBy('username'), startAfter(lastVisibleUser), limit(10));
        } else {
            q = query(collection(db, 'users'), orderBy('username'), limit(10));
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            if (!loadMore) {
                listContainer.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">👥</div>
                        <p>No members found.</p>
                    </div>
                `;
            }
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleUser = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        snapshot.docs.forEach((d) => renderUserCard(d.id, d.data()));

        if (loadMoreContainer) {
            if (snapshot.size === 10) {
                loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load More</button>';
                const loadMoreBtn = document.getElementById('load-more-btn');
                if (loadMoreBtn) {
                    loadMoreBtn.addEventListener('click', () => fetchUsersForAdmin(true));
                }
            } else {
                loadMoreContainer.innerHTML = '';
            }
        }
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    }
}

function renderUserCard(uid, data) {
    const listContainer = document.getElementById('users-card-list');
    if (!listContainer) return;

    const card = document.createElement('div');
    card.className = 'card border-blue';
    card.id = `card-${uid}`;
    card.setAttribute('role', 'region');
    card.setAttribute('aria-labelledby', `member-title-${uid}`);

    let actionsHtml = '';
    if (!data.isProtected) {
        actionsHtml = `
            <div class="action-buttons" id="member-actions-${uid}">
                <button type="button" class="action-btn action-btn-edit" data-action="edit" aria-label="Edit member ${escapeHtml(data.username)}">✎ Edit</button>
                <button type="button" class="action-btn action-btn-activity" data-action="activity" aria-label="View activity for ${escapeHtml(data.username)}">📋 Activity</button>
                ${data.role === 'user'
                    ? '<button type="button" class="action-btn action-btn-promote" data-action="promote" aria-label="Promote to admin">↑ Promote</button>'
                    : '<button type="button" class="action-btn action-btn-demote" data-action="demote" aria-label="Demote to user">↓ Demote</button>'}
                ${data.status === 'active'
                    ? '<button type="button" class="action-btn action-btn-suspend" data-action="suspend" aria-label="Suspend member">⏸ Suspend</button>'
                    : '<button type="button" class="action-btn action-btn-activate" data-action="activate" aria-label="Activate member">▶ Activate</button>'}
            </div>
            <div id="activity-area-${uid}" style="margin-top: 15px; display: none;"></div>
        `;
    } else {
        actionsHtml = `
            <div class="action-buttons" id="member-actions-${uid}">
                <button type="button" class="action-btn action-btn-activity" data-action="activity" aria-label="View activity for ${escapeHtml(data.username)}">📋 Activity</button>
            </div>
            <div id="activity-area-${uid}" style="margin-top: 15px; display: none;"></div>
        `;
    }

    card.innerHTML = `
        <div class="card-header" id="header-${uid}" tabindex="0" role="button" aria-expanded="false" aria-controls="body-${uid}">
            <div class="card-header-top">
                <span class="card-title" id="member-title-${uid}">${escapeHtml(data.username)}</span>
                <div class="card-meta">
                    <span class="role-${data.role}">${data.role}</span>
                    <span class="status-${data.status}">${data.status}</span>
                </div>
            </div>
            <div class="card-header-plates" id="header-plates-${uid}">
                <span class="no-cars-label">Click to load assigned cars</span>
            </div>
        </div>
        <div class="card-body" id="body-${uid}">
            <div id="view-info-${uid}">
                <div class="detail-list">
                    <div class="detail-item">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${escapeHtml(data.email)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Phone</span>
                        <span class="detail-value">${escapeHtml(data.phone)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Notes</span>
                        <span class="detail-value">${escapeHtml(data.notes) || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Assigned Cars</span>
                        <span class="detail-value" id="cars-detail-${uid}">Click card to load</span>
                    </div>
                </div>
                <div style="margin-top: 15px;">${actionsHtml}</div>
            </div>
            <div id="edit-form-${uid}" style="display:none;"></div>
        </div>
    `;
    listContainer.appendChild(card);

    const headerEl = card.querySelector(`#header-${uid}`);
    if (headerEl) {
        const toggleCard = async (e) => {
            if (e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            const wasOpen = card.classList.contains('open');
            card.classList.toggle('open');
            headerEl.setAttribute('aria-expanded', !wasOpen);
            if (!wasOpen) {
                await loadUserCars(uid);
            }
        };
        headerEl.addEventListener('click', toggleCard);
        headerEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCard(e);
            }
        });
    }

    const actionsWrap = card.querySelector(`#member-actions-${uid}`);
    if (actionsWrap) {
        actionsWrap.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleMemberAction(uid, btn.getAttribute('data-action'), data.username, data);
            });
        });
    }
}

async function loadUserCars(uid) {
    const headerPlates = document.getElementById(`header-plates-${uid}`);
    const carsDetail = document.getElementById(`cars-detail-${uid}`);
    if (!headerPlates) return;

    if (headerPlates.dataset.loaded === 'true') return;
    headerPlates.innerHTML = '<span class="no-cars-label">Loading cars...</span>';

    try {
        const carsQ = query(collection(db, 'cars'), where('currentUserId', '==', uid));
        const carsSnap = await getDocs(carsQ);

        if (carsSnap.empty) {
            headerPlates.innerHTML = '<span class="no-cars-label">No cars assigned</span>';
            if (carsDetail) carsDetail.textContent = 'No cars assigned';
        } else {
            const plateItems = [];
            carsSnap.forEach(d => {
                const c = d.data();
                plateItems.push(`
                    <div class="mini-plate" title="${escapeHtml(c.carId || '')}">
                        <span class="mini-plate-emirate">${escapeHtml(c.emirate || '')}</span>
                        <span class="mini-plate-number">${escapeHtml(c.plateNumber || '')}</span>
                        <span class="mini-plate-code">${escapeHtml(c.plateCode || '')}</span>
                    </div>
                `);
            });

            if (plateItems.length === 1) {
                headerPlates.innerHTML = `<div class="mini-plates-container">${plateItems[0]}</div>`;
            } else {
                headerPlates.innerHTML = `
                    <div class="mini-plates-container" id="header-plates-visible-${uid}">
                        ${plateItems[0]}
                    </div>
                    <div class="mini-plates-container" id="header-plates-extra-${uid}" style="display:none;">
                        ${plateItems.slice(1).join('')}
                    </div>
                    <button type="button" class="show-more-plates-btn" id="show-more-plates-${uid}">
                        Show more (${plateItems.length - 1})
                    </button>
                `;

                const showMoreBtn = document.getElementById(`show-more-plates-${uid}`);
                if (showMoreBtn) {
                    showMoreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const extra = document.getElementById(`header-plates-extra-${uid}`);
                        if (!extra) return;
                        const isHidden = extra.style.display === 'none' || !extra.style.display;
                        if (isHidden) {
                            extra.style.display = 'flex';
                            showMoreBtn.textContent = 'Show less';
                        } else {
                            extra.style.display = 'none';
                            showMoreBtn.textContent = `Show more (${plateItems.length - 1})`;
                        }
                    });
                }
            }

            if (carsDetail) {
                carsDetail.innerHTML = `<div class="mini-plates-container">${plateItems.join('')}</div>`;
            }
        }
        headerPlates.dataset.loaded = 'true';
    } catch (err) {
        headerPlates.innerHTML = '<span class="no-cars-label">Unable to load cars</span>';
        if (carsDetail) carsDetail.textContent = 'Unable to load';
    }
}

async function handleMemberAction(uid, action, username, fullData) {
    if (!isAdmin(currentUserData) || !action) return;

    const activityArea = document.getElementById(`activity-area-${uid}`);
    if (activityArea) activityArea.style.display = 'none';

    const executeAction = async () => {
        try {
            if (action === 'promote') {
                await updateDoc(doc(db, 'users', uid), { role: 'admin' });
                await logAction(currentUserData, 'PROMOTE_USER', {
                    targetId: uid,
                    targetName: username,
                    text: `Promoted ${username}`
                });
            } else if (action === 'demote') {
                await updateDoc(doc(db, 'users', uid), { role: 'user' });
                await logAction(currentUserData, 'DEMOTE_USER', {
                    targetId: uid,
                    targetName: username,
                    text: `Demoted ${username}`
                });
            } else if (action === 'suspend') {
                await updateDoc(doc(db, 'users', uid), { status: 'suspended' });
                await logAction(currentUserData, 'SUSPEND_USER', {
                    targetId: uid,
                    targetName: username,
                    text: `Suspended ${username}`
                });
            } else if (action === 'activate') {
                await updateDoc(doc(db, 'users', uid), { status: 'active' });
                await logAction(currentUserData, 'ACTIVATE_USER', {
                    targetId: uid,
                    targetName: username,
                    text: `Activated ${username}`
                });
            } else if (action === 'edit') {
                renderInlineEditForm(uid);
                return;
            } else if (action === 'activity') {
                await renderUserActivity(uid);
                return;
            }

            showMessage(`Action completed for ${username}.`, 'success', 'dashboard');
            lastVisibleUser = null;
            fetchUsersForAdmin(false);
        } catch (error) {
            handleFirebaseError(error, 'dashboard');
        }
    };

    if (['promote', 'demote', 'suspend', 'activate'].includes(action)) {
        const actionLabels = {
            promote: { title: 'Confirm Promote', msg: `Promote "${escapeHtml(username)}" to admin?`, confirm: 'Promote' },
            demote: { title: 'Confirm Demote', msg: `Demote "${escapeHtml(username)}" to user?`, confirm: 'Demote' },
            suspend: { title: 'Confirm Suspend', msg: `Suspend "${escapeHtml(username)}"? They will lose access immediately.`, confirm: 'Suspend', danger: true },
            activate: { title: 'Confirm Activate', msg: `Activate "${escapeHtml(username)}"?`, confirm: 'Activate' }
        };
        const cfg = actionLabels[action];
        renderConfirmDialog({
            title: cfg.title,
            message: cfg.msg,
            confirmText: cfg.confirm,
            danger: cfg.danger || false,
            onConfirm: executeAction
        });
    } else {
        await executeAction();
    }
}

async function renderUserActivity(uid) {
    const activityArea = document.getElementById(`activity-area-${uid}`);
    if (!activityArea) return;

    activityArea.style.display = 'block';
    activityArea.innerHTML = '<p class="loading-text" style="font-size: 0.85rem;">Loading activity...</p>';

    try {
        const actorQ = query(collection(db, 'logs'), where('actorId', '==', uid), limit(20));
        const actorSnap = await getDocs(actorQ);

        const assigneeQ = query(collection(db, 'logs'), where('assigneeId', '==', uid), limit(20));
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
                text = `Assigned car <strong>${escapeHtml(log.targetName || log.targetId)}</strong>`;
            } else if (log.actionType === 'CAR_UNASSIGN' || log.actionType === 'APPROVE_UNLINK') {
                itemClass += ' completed';
                text = `Unassigned car <strong>${escapeHtml(log.targetName || log.targetId)}</strong>`;
            } else if (log.actionType === 'LOGIN') {
                text = 'Logged into the system';
            } else if (log.actionType === 'LOGOUT') {
                text = 'Logged out';
            }

            html += `
                <div class="${itemClass}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-date">${dateStr}</div>
                        <div class="timeline-text">${text}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        activityArea.innerHTML = html;
    } catch (error) {
        activityArea.innerHTML = `<p class="error" style="font-size:0.85rem;">Error: ${escapeHtml(error.message)}</p>`;
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
            <div class="form-group">
                <label for="edit-un-${uid}">Username</label>
                <input type="text" id="edit-un-${uid}" value="${escapeHtml(data.username)}" required>
            </div>
            <div class="form-group">
                <label for="edit-em-${uid}">Email</label>
                <input type="email" id="edit-em-${uid}" value="${escapeHtml(data.email)}" required>
            </div>
            <div class="form-group">
                <label for="edit-ph-${uid}">Phone</label>
                <input type="text" id="edit-ph-${uid}" value="${escapeHtml(data.phone)}" required pattern="0\d{9}" lang="en" dir="ltr">
            </div>
            <div class="form-group">
                <label for="edit-nt-${uid}">Notes (Admin only)</label>
                <input type="text" id="edit-nt-${uid}" value="${escapeHtml(data.notes || '')}">
            </div>
            <div class="form-group full-width" style="display:flex; gap:10px;">
                <button type="submit" class="btn btn-sm" id="edit-save-${uid}">Save Changes</button>
                <button type="button" class="btn btn-sm btn-secondary" id="cancel-edit-${uid}">Cancel</button>
            </div>
        </form>
    `;

    const formEdit = document.getElementById(`form-edit-${uid}`);
    if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const saveBtn = document.getElementById(`edit-save-${uid}`);
            setButtonLoading(saveBtn, 'Saving...');

            const unEl = document.getElementById(`edit-un-${uid}`);
            const emEl = document.getElementById(`edit-em-${uid}`);
            const phEl = document.getElementById(`edit-ph-${uid}`);
            const ntEl = document.getElementById(`edit-nt-${uid}`);
            if (!unEl || !emEl || !phEl) return;

            const newUsername = unEl.value.trim();
            const newEmail = emEl.value.trim();
            const newPhone = sanitizeInput(`edit-ph-${uid}`);
            const newNotes = ntEl ? ntEl.value.trim() : '';

            if (!validators.phone(newPhone)) {
                showMessage('Error: Phone must be 10 digits starting with 0.', 'error', 'dashboard');
                resetButtonLoading(saveBtn);
                return;
            }

            try {
                await updateDoc(doc(db, 'users', uid), {
                    username: newUsername,
                    email: newEmail,
                    phone: newPhone,
                    notes: newNotes
                });

                await logAction(currentUserData, 'EDIT_USER', {
                    targetId: uid,
                    targetName: newUsername,
                    text: `Edited details for ${newUsername}`
                });

                showMessage('Member updated successfully.', 'success', 'dashboard');
                lastVisibleUser = null;
                fetchUsersForAdmin(false);
            } catch (err) {
                handleFirebaseError(err, 'dashboard');
            } finally {
                resetButtonLoading(saveBtn);
            }
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
        showMessage('Only Super Admin can use this secure edit feature.', 'warning', 'dashboard');
        return;
    }

    const container = document.getElementById('dashboard-container');
    if (!container) return;

    container.innerHTML = `
        <h2>Edit Protected Profile</h2>
        <p style="color: #666; margin-bottom: 20px; text-align:center;">Two-step verification required.</p>
        <form id="edit-profile-form" style="max-width: 500px; margin: 0 auto;">
            <div class="form-group">
                <label for="verify-password">Current Password</label>
                <input type="password" id="verify-password" required autocomplete="current-password">
            </div>
            <div class="form-group">
                <label for="verify-pin">Current Security PIN (4 digits)</label>
                <input type="password" id="verify-pin" required pattern="\d{4}" inputmode="numeric" maxlength="4" lang="en" dir="ltr">
            </div>
            <div class="divider"></div>
            <div class="form-group">
                <label for="edit-username">New Username</label>
                <input type="text" id="edit-username" value="${escapeHtml(currentUserData.username)}" required>
            </div>
            <div class="form-group">
                <label for="edit-phone">New Phone</label>
                <input type="text" id="edit-phone" value="${escapeHtml(currentUserData.phone)}" required pattern="0\d{9}" lang="en" dir="ltr">
            </div>
            <div class="divider"></div>
            <p style="color:#666; font-size:0.9rem; margin-bottom:12px; text-align:center;">
                Leave New PIN fields empty if you do not want to change the PIN.
            </p>
            <div class="form-group">
                <label for="edit-new-pin">New Security PIN (4 digits, optional)</label>
                <input type="password" id="edit-new-pin" pattern="\d{4}" inputmode="numeric" maxlength="4" lang="en" dir="ltr" placeholder="Leave blank to keep current">
            </div>
            <div class="form-group">
                <label for="edit-confirm-pin">Confirm New Security PIN</label>
                <input type="password" id="edit-confirm-pin" pattern="\d{4}" inputmode="numeric" maxlength="4" lang="en" dir="ltr" placeholder="Leave blank to keep current">
            </div>
            <button type="submit" class="btn" id="profile-submit">Verify & Update</button>
            <button type="button" class="btn btn-secondary" id="cancel-edit" style="margin-top:10px;">Cancel</button>
        </form>
    `;

    const editProfileForm = document.getElementById('edit-profile-form');
    const cancelEdit = document.getElementById('cancel-edit');
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', handleEditProtectedProfile);
    }
    if (cancelEdit) {
        cancelEdit.addEventListener('click', renderDashboard);
    }
}

async function handleEditProtectedProfile(e) {
    e.preventDefault();
    if (!currentUserData.isProtected) return;

    const submitBtn = document.getElementById('profile-submit');
    setButtonLoading(submitBtn, 'Verifying...');

    const passwordEl = document.getElementById('verify-password');
    const pinEl = document.getElementById('verify-pin');
    const usernameEl = document.getElementById('edit-username');
    const phoneEl = document.getElementById('edit-phone');
    const newPinEl = document.getElementById('edit-new-pin');
    const confirmPinEl = document.getElementById('edit-confirm-pin');

    if (!passwordEl || !pinEl || !usernameEl || !phoneEl) return;

    const password = passwordEl.value;
    const pin = pinEl.value;
    const newUsername = usernameEl.value.trim();
    const newPhone = sanitizeInput('edit-phone');
    const newPin = newPinEl ? sanitizeInput('edit-new-pin') : '';
    const confirmPin = confirmPinEl ? sanitizeInput('edit-confirm-pin') : '';

    if (containsNonEnglishDigits(pin)) {
        showMessage('Error: PIN must use English digits (0-9) only.', 'error', 'dashboard');
        resetButtonLoading(submitBtn);
        return;
    }
    if (pin !== currentUserData.securityPin) {
        showMessage('Security Error: Invalid Security PIN.', 'error', 'dashboard');
        resetButtonLoading(submitBtn);
        return;
    }
    if (!validators.phone(newPhone)) {
        showMessage('Error: Phone must start with 0 and be 10 digits.', 'error', 'dashboard');
        resetButtonLoading(submitBtn);
        return;
    }

    if (newPin || confirmPin) {
        if (!validators.pin(newPin)) {
            showMessage('Error: New Security PIN must be exactly 4 digits.', 'error', 'dashboard');
            resetButtonLoading(submitBtn);
            return;
        }
        if (newPin !== confirmPin) {
            showMessage('Error: New PIN and confirmation do not match.', 'error', 'dashboard');
            resetButtonLoading(submitBtn);
            return;
        }
        if (newPin === pin) {
            showMessage('Error: New PIN must be different from the current PIN.', 'error', 'dashboard');
            resetButtonLoading(submitBtn);
            return;
        }
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
            if (!snapshot.empty) {
                showMessage('Error: Username already exists.', 'error', 'dashboard');
                resetButtonLoading(submitBtn);
                return;
            }
        }

        const updates = {
            username: newUsername,
            phone: newPhone
        };
        if (newPin) {
            updates.securityPin = newPin;
        }

        await updateDoc(doc(db, 'users', currentUserData.uid), updates);

        await logAction(currentUserData, 'EDIT_SELF_PROFILE', {
            targetId: currentUserData.uid,
            targetName: newUsername,
            text: newPin
                ? 'Super Admin updated own profile and security PIN'
                : 'Super Admin updated own profile'
        });

        showMessage('Profile updated. Reloading...', 'success', 'dashboard');
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    } finally {
        resetButtonLoading(submitBtn);
    }
}

/* ═══════════════════════════════════════════
   MY PERSONAL ACTIVITY (for My Activity tab)
   ═══════════════════════════════════════════ */
export async function renderMyPersonalActivity() {
    const container = document.getElementById('dashboard-container');
    if (!container || !currentUserData) return;

    container.innerHTML = `
        <h2>My Activity</h2>
        <div class="divider"></div>
        <div id="my-activity-timeline" class="timeline">
            <p class="loading-text">Loading your activity...</p>
        </div>
    `;

    const timeline = document.getElementById('my-activity-timeline');
    if (!timeline) return;

    try {
        const actorQ = query(collection(db, 'logs'), where('actorId', '==', currentUserData.uid), limit(30));
        const assigneeQ = query(collection(db, 'logs'), where('assigneeId', '==', currentUserData.uid), limit(30));

        const [actorSnap, assigneeSnap] = await Promise.all([
            getDocs(actorQ),
            getDocs(assigneeQ)
        ]);

        const logs = [];
        actorSnap.forEach(d => logs.push(d.data()));
        assigneeSnap.forEach(d => logs.push(d.data()));

        logs.sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const tB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return tB - tA;
        });

        if (logs.length === 0) {
            timeline.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <p>No activity recorded yet.</p>
                </div>
            `;
            return;
        }

        let html = '';
        logs.slice(0, 25).forEach(log => {
            const dateStr = formatDateTime(log.timestamp);
            let itemClass = 'timeline-item';
            let text = log.details || '';

            if (log.actionType === 'CAR_ASSIGN' || log.actionType === 'AUTO_LINK') {
                itemClass += ' ongoing';
                text = `Assigned car <strong>${escapeHtml(log.targetName || log.targetId)}</strong>`;
            } else if (log.actionType === 'CAR_UNASSIGN' || log.actionType === 'APPROVE_UNLINK') {
                itemClass += ' completed';
                text = `Unassigned car <strong>${escapeHtml(log.targetName || log.targetId)}</strong>`;
            } else if (log.actionType === 'LOGIN') {
                text = 'Logged into the system';
            } else if (log.actionType === 'LOGOUT') {
                text = 'Logged out';
            } else if (log.actionType === 'REQUEST_LINK') {
                text = `Requested link: ${escapeHtml(log.targetName || '')}`;
            } else if (log.actionType === 'REQUEST_UNLINK') {
                text = `Requested unlink: ${escapeHtml(log.targetName || '')}`;
            }

            html += `
                <div class="${itemClass}">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="timeline-date">${dateStr}</div>
                        <div class="timeline-text">${text}</div>
                    </div>
                </div>
            `;
        });
        timeline.innerHTML = html;
    } catch (error) {
        timeline.innerHTML = `<p class="error">Error: ${escapeHtml(error.message)}</p>`;
    }
}
