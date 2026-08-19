/**
 * Members Module - Car Management System
 * English only | Latin digits only | Production-ready
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
    t, lockUI, unlockUI
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
            <h2>${t('dash.adminDashboard')}</h2>
            <p style="text-align:center;">${t('common.welcome', { username: currentUserData.username })}</p>
            <button class="btn btn-sm btn-warning" id="edit-profile-btn" style="margin-top: 10px;">${t('members.editProfile')}</button>
        </div>
        <div class="divider"></div>
        <button class="btn-add-toggle" id="toggle-add-member">${t('members.addNew')}</button>
        <div id="add-member-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
            <form id="add-user-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group">
                    <label>${t('auth.username')}</label>
                    <input type="text" id="new-username" required>
                </div>
                <div class="form-group">
                    <label>${t('auth.email')}</label>
                    <input type="email" id="new-email" required>
                </div>
                <div class="form-group">
                    <label>${t('auth.password')}</label>
                    <input type="password" id="new-password" required minlength="6">
                </div>
                <div class="form-group">
                    <label>${t('auth.phone')}</label>
                    <input type="text" id="new-phone" required pattern="0\\d{9}" placeholder="0XXXXXXXXX">
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>${t('members.role')}</label>
                    <select id="new-role">
                        <option value="user">${t('members.role')}</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <button type="submit" class="btn">${t('members.addMember')}</button>
                </div>
            </form>
        </div>
        <h3>${t('members.title')}</h3>
        <div id="users-card-list" class="card-list">
            <p class="loading-text">${t('common.loading')}</p>
        </div>
        <div id="load-more-container" class="load-more-container"></div>
    `;

    const toggleAddMember = document.getElementById('toggle-add-member');
    const addUserForm = document.getElementById('add-user-form');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (toggleAddMember) {
        toggleAddMember.addEventListener('click', () => {
            const wrapper = document.getElementById('add-member-form-wrapper');
            if (wrapper) wrapper.classList.toggle('hidden-form');
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
        showMessage(t('error.general'), 'error', 'dashboard');
        return;
    }

    const username = usernameEl.value.trim();
    const email = emailEl.value.trim();
    const password = passwordEl.value;
    const phone = phoneEl.value.trim();
    const role = roleEl.value;

    if (!/^0\d{9}$/.test(phone)) {
        showMessage(t('error.phoneInvalid'), 'error', 'dashboard');
        return;
    }

    lockUI();
    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            showMessage(t('error.usernameExists'), 'error', 'dashboard');
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
            rememberSession: false,
            preferredLanguage: 'en' // اللغة الافتراضية
        });

        await secondaryAuth.signOut();

        await logAction(currentUserData, 'CREATE_USER', {
            targetId: uid,
            targetName: username,
            text: t('members.memberAdded')
        });

        showMessage(t('members.memberAdded'), 'success', 'dashboard');
        const addForm = document.getElementById('add-user-form');
        if (addForm) addForm.reset();
        const addWrapper = document.getElementById('add-member-form-wrapper');
        if (addWrapper) addWrapper.classList.add('hidden-form');
        lastVisibleUser = null;
        fetchUsersForAdmin(false);
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    } finally {
        unlockUI();
    }
}

async function fetchUsersForAdmin(loadMore = false) {
    if (!isAdmin(currentUserData)) return;

    const listContainer = document.getElementById('users-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!listContainer) return;

    if (!loadMore) listContainer.innerHTML = `<p class="loading-text">${t('common.loading')}</p>`;

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
                listContainer.innerHTML = `<p style="text-align:center; color:#666;">${t('members.noMembers')}</p>`;
            }
            if (loadMoreContainer) loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleUser = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        snapshot.docs.forEach((d) => renderUserCard(d.id, d.data()));

        if (loadMoreContainer) {
            if (snapshot.size === 10) {
                loadMoreContainer.innerHTML = `<button class="load-more-btn" id="load-more-btn">${t('common.loadMore')}</button>`;
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

    let actionsHtml = '';
    if (!data.isProtected) {
        actionsHtml = `
            <div class="action-buttons" id="member-actions-${uid}">
                <button type="button" class="action-btn action-btn-edit" data-action="edit">${t('common.edit')}</button>
                <button type="button" class="action-btn action-btn-activity" data-action="activity">${t('members.activity')}</button>
                ${data.role === 'user'
                    ? `<button type="button" class="action-btn action-btn-promote" data-action="promote">${t('members.promote')}</button>`
                    : `<button type="button" class="action-btn action-btn-demote" data-action="demote">${t('members.demote')}</button>`}
                ${data.status === 'active'
                    ? `<button type="button" class="action-btn action-btn-suspend" data-action="suspend">${t('members.suspend')}</button>`
                    : `<button type="button" class="action-btn action-btn-activate" data-action="activate">${t('members.activate')}</button>`}
            </div>
            <div id="activity-area-${uid}" style="margin-top: 15px; display: none;"></div>
        `;
    } else {
        actionsHtml = `
            <div class="action-buttons" id="member-actions-${uid}">
                <button type="button" class="action-btn action-btn-activity" data-action="activity">${t('members.activity')}</button>
            </div>
            <div id="activity-area-${uid}" style="margin-top: 15px; display: none;"></div>
        `;
    }

    card.innerHTML = `
        <div class="card-header" id="header-${uid}">
            <div class="card-header-top">
                <span class="card-title">${data.username}</span>
                <div class="card-meta">
                    <span class="role-${data.role}">${data.role}</span>
                    <span class="status-${data.status}">${data.status}</span>
                </div>
            </div>
            <div class="card-header-plates" id="header-plates-${uid}">
                <span class="no-cars-label">${t('members.clickToLoad')}</span>
            </div>
        </div>
        <div class="card-body" id="body-${uid}">
            <div id="view-info-${uid}">
                <div class="detail-list">
                    <div class="detail-item">
                        <span class="detail-label">${t('auth.email')}</span>
                        <span class="detail-value">${data.email}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">${t('auth.phone')}</span>
                        <span class="detail-value">${data.phone}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">${t('members.notes')}</span>
                        <span class="detail-value">${data.notes || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">${t('members.assignedCars')}</span>
                        <span class="detail-value" id="cars-detail-${uid}">${t('members.clickToLoad')}</span>
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
        headerEl.addEventListener('click', async (e) => {
            if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
                const wasOpen = card.classList.contains('open');
                card.classList.toggle('open');
                if (!wasOpen) {
                    await loadUserCars(uid);
                }
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
}

async function loadUserCars(uid) {
    const headerPlates = document.getElementById(`header-plates-${uid}`);
    const carsDetail = document.getElementById(`cars-detail-${uid}`);
    if (!headerPlates) return;

    if (headerPlates.dataset.loaded === 'true') return;
    headerPlates.innerHTML = `<span class="no-cars-label">${t('members.loadingCars')}</span>`;

    try {
        const carsQ = query(collection(db, 'cars'), where('currentUserId', '==', uid));
        const carsSnap = await getDocs(carsQ);

        if (carsSnap.empty) {
            headerPlates.innerHTML = `<span class="no-cars-label">${t('members.noCarsAssigned')}</span>`;
            if (carsDetail) carsDetail.textContent = t('members.noCarsAssigned');
        } else {
            const plateItems = [];
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
                        ${t('common.loadMore')} (${plateItems.length - 1})
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
                            showMoreBtn.textContent = t('common.close');
                        } else {
                            extra.style.display = 'none';
                            showMoreBtn.textContent = `${t('common.loadMore')} (${plateItems.length - 1})`;
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
        headerPlates.innerHTML = `<span class="no-cars-label">${t('members.unableToLoadCars')}</span>`;
        if (carsDetail) carsDetail.textContent = t('members.unableToLoadCars');
    }
}

async function handleMemberAction(uid, action, username) {
    if (!isAdmin(currentUserData) || !action) return;

    const activityArea = document.getElementById(`activity-area-${uid}`);
    if (activityArea) activityArea.style.display = 'none';

    lockUI();
    try {
        if (action === 'promote') {
            await updateDoc(doc(db, 'users', uid), { role: 'admin' });
            await logAction(currentUserData, 'PROMOTE_USER', {
                targetId: uid,
                targetName: username,
                text: t('members.actionCompleted', { username })
            });
        } else if (action === 'demote') {
            await updateDoc(doc(db, 'users', uid), { role: 'user' });
            await logAction(currentUserData, 'DEMOTE_USER', {
                targetId: uid,
                targetName: username,
                text: t('members.actionCompleted', { username })
            });
        } else if (action === 'suspend') {
            if (!confirm(t('members.suspendConfirm', { username }))) {
                return;
            }
            await updateDoc(doc(db, 'users', uid), { status: 'suspended' });
            await logAction(currentUserData, 'SUSPEND_USER', {
                targetId: uid,
                targetName: username,
                text: t('members.actionCompleted', { username })
            });
        } else if (action === 'activate') {
            await updateDoc(doc(db, 'users', uid), { status: 'active' });
            await logAction(currentUserData, 'ACTIVATE_USER', {
                targetId: uid,
                targetName: username,
                text: t('members.actionCompleted', { username })
            });
        } else if (action === 'edit') {
            renderInlineEditForm(uid);
            return;
        } else if (action === 'activity') {
            await renderUserActivity(uid);
            return;
        }

        showMessage(t('members.actionCompleted', { username }), 'success', 'dashboard');
        lastVisibleUser = null;
        fetchUsersForAdmin(false);
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    } finally {
        unlockUI();
    }
}

async function renderUserActivity(uid) {
    const activityArea = document.getElementById(`activity-area-${uid}`);
    if (!activityArea) return;

    activityArea.style.display = 'block';
    activityArea.innerHTML = `<p class="loading-text" style="font-size: 0.85rem;">${t('common.loading')}</p>`;

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
            activityArea.innerHTML = `<p style="font-size:0.85rem; text-align:center; color:#666;">${t('dash.noActivity')}</p>`;
            return;
        }

        let html = '<div class="timeline">';
        logs.slice(0, 15).forEach(log => {
            const dateStr = formatDateTime(log.timestamp);
            let itemClass = 'timeline-item';
            let text = log.details || '';

            if (log.actionType === 'CAR_ASSIGN' || log.actionType === 'AUTO_LINK') {
                itemClass += ' ongoing';
                text = `${t('cars.assign')} ${t('cars.carLabel', { plateNumber: log.targetName || '', plateCode: '', emirate: '' })}`;
            } else if (log.actionType === 'CAR_UNASSIGN' || log.actionType === 'APPROVE_UNLINK') {
                itemClass += ' completed';
                text = `${t('cars.unassign')} ${t('cars.carLabel', { plateNumber: log.targetName || '', plateCode: '', emirate: '' })}`;
            } else if (log.actionType === 'LOGIN') {
                text = t('dash.loggedIn');
            } else if (log.actionType === 'LOGOUT') {
                text = t('dash.loggedOut');
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
        activityArea.innerHTML = `<p class="error" style="font-size:0.85rem;">${t('error.general')}</p>`;
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
                <label>${t('auth.username')}</label>
                <input type="text" id="edit-un-${uid}" value="${data.username}" required>
            </div>
            <div class="form-group">
                <label>${t('auth.email')}</label>
                <input type="email" id="edit-em-${uid}" value="${data.email}" required>
            </div>
            <div class="form-group">
                <label>${t('auth.phone')}</label>
                <input type="text" id="edit-ph-${uid}" value="${data.phone}" required pattern="0\\d{9}">
            </div>
            <div class="form-group">
                <label>${t('members.notes')} (${t('members.role')})</label>
                <input type="text" id="edit-nt-${uid}" value="${data.notes || ''}">
            </div>
            <div class="form-group full-width" style="display:flex; gap:10px;">
                <button type="submit" class="btn btn-sm">${t('common.save')}</button>
                <button type="button" class="btn btn-sm btn-secondary" id="cancel-edit-${uid}">${t('common.cancel')}</button>
            </div>
        </form>
    `;

    const formEdit = document.getElementById(`form-edit-${uid}`);
    if (formEdit) {
        formEdit.addEventListener('submit', async (e) => {
            e.preventDefault();
            const unEl = document.getElementById(`edit-un-${uid}`);
            const emEl = document.getElementById(`edit-em-${uid}`);
            const phEl = document.getElementById(`edit-ph-${uid}`);
            const ntEl = document.getElementById(`edit-nt-${uid}`);
            if (!unEl || !emEl || !phEl) return;

            const newUsername = unEl.value.trim();
            const newEmail = emEl.value.trim();
            const newPhone = phEl.value.trim();
            const newNotes = ntEl ? ntEl.value.trim() : '';

            if (!/^0\d{9}$/.test(newPhone)) {
                showMessage(t('error.phoneInvalid'), 'error', 'dashboard');
                return;
            }

            lockUI();
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
                    text: t('members.memberUpdated')
                });

                showMessage(t('members.memberUpdated'), 'success', 'dashboard');
                lastVisibleUser = null;
                fetchUsersForAdmin(false);
            } catch (err) {
                handleFirebaseError(err, 'dashboard');
            } finally {
                unlockUI();
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
        showMessage(t('error.permissionDenied'), 'warning', 'dashboard');
        return;
    }

    const container = document.getElementById('dashboard-container');
    if (!container) return;

    container.innerHTML = `
        <h2>${t('members.editProtectedProfile')}</h2>
        <p style="color: #666; margin-bottom: 20px; text-align:center;">${t('members.twoStepVerification')}</p>
        <form id="edit-profile-form" style="max-width: 500px; margin: 0 auto;">
            <div class="form-group">
                <label>${t('members.verifyPassword')}</label>
                <input type="password" id="verify-password" required autocomplete="current-password">
            </div>
            <div class="form-group">
                <label>${t('members.verifyPin')}</label>
                <input type="password" id="verify-pin" required pattern="\\d{4}" inputmode="numeric" maxlength="4">
            </div>
            <div class="divider"></div>
            <div class="form-group">
                <label>${t('members.newUsername')}</label>
                <input type="text" id="edit-username" value="${currentUserData.username}" required>
            </div>
            <div class="form-group">
                <label>${t('members.newPhone')}</label>
                <input type="text" id="edit-phone" value="${currentUserData.phone}" required pattern="0\\d{9}">
            </div>
            <div class="divider"></div>
            <p style="color:#666; font-size:0.9rem; margin-bottom:12px; text-align:center;">
                ${t('members.pinLeaveBlank')}
            </p>
            <div class="form-group">
                <label>${t('members.newPin')}</label>
                <input type="password" id="edit-new-pin" pattern="\\d{4}" inputmode="numeric" maxlength="4" placeholder="${t('members.pinLeaveBlank')}">
            </div>
            <div class="form-group">
                <label>${t('members.confirmNewPin')}</label>
                <input type="password" id="edit-confirm-pin" pattern="\\d{4}" inputmode="numeric" maxlength="4" placeholder="${t('members.pinLeaveBlank')}">
            </div>
            <button type="submit" class="btn">${t('members.verifyAndUpdate')}</button>
            <button type="button" class="btn btn-secondary" id="cancel-edit" style="margin-top:10px;">${t('common.cancel')}</button>
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
    const newPhone = phoneEl.value.trim();
    const newPin = newPinEl ? newPinEl.value.trim() : '';
    const confirmPin = confirmPinEl ? confirmPinEl.value.trim() : '';

    if (pin !== currentUserData.securityPin) {
        showMessage(t('error.pinInvalid'), 'error', 'dashboard');
        return;
    }
    if (!/^0\d{9}$/.test(newPhone)) {
        showMessage(t('error.phoneInvalid'), 'error', 'dashboard');
        return;
    }

    if (newPin || confirmPin) {
        if (!/^\d{4}$/.test(newPin)) {
            showMessage(t('error.pinInvalid'), 'error', 'dashboard');
            return;
        }
        if (newPin !== confirmPin) {
            showMessage(t('error.pinMismatch'), 'error', 'dashboard');
            return;
        }
        if (newPin === pin) {
            showMessage(t('error.pinMustDiffer'), 'error', 'dashboard');
            return;
        }
    }

    lockUI();
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
                showMessage(t('error.usernameExists'), 'error', 'dashboard');
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
                ? t('members.profileUpdated')
                : t('members.profileUpdated')
        });

        showMessage(t('members.profileUpdated'), 'success', 'dashboard');
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    } finally {
        unlockUI();
    }
}

// My Personal Activity

export function renderMyPersonalActivity() {
    if (!currentUserData || !currentUserData.uid) {
        renderAccessDenied();
        return;
    }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <h2>${t('dash.myPersonalActivity')}</h2>
        <p style="text-align:center; color:#666; margin-bottom:20px;">
            ${t('dash.activityHistory')}
        </p>
        <div class="divider"></div>
        <div id="my-activity-timeline" class="timeline">
            <p class="loading-text">${t('common.loading')}</p>
        </div>
    `;

    loadMyPersonalActivity();
}

async function loadMyPersonalActivity() {
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

        const unique = [];
        const seen = new Set();
        logs.forEach(log => {
            const key = `${log.timestamp?.seconds || 0}-${log.actionType}-${log.details || ''}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(log);
            }
        });

        unique.sort((a, b) => {
            const tA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const tB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return tB - tA;
        });

        if (unique.length === 0) {
            timeline.innerHTML = `<p style="text-align:center; color:#666;">${t('dash.noActivity')}</p>`;
            return;
        }

        let html = '';
        unique.slice(0, 25).forEach(log => {
            const dateStr = formatDateTime(log.timestamp);
            let itemClass = 'timeline-item';
            let text = log.details || log.actionType;

            if (log.actionType === 'CAR_ASSIGN' || log.actionType === 'AUTO_LINK' || log.actionType === 'APPROVE_LINK') {
                itemClass += ' ongoing';
                text = `${t('cars.assign')} ${t('cars.carLabel', { plateNumber: log.targetName || '', plateCode: '', emirate: '' })}`;
            } else if (log.actionType === 'CAR_UNASSIGN' || log.actionType === 'APPROVE_UNLINK' || log.actionType === 'REQUEST_UNLINK') {
                itemClass += ' completed';
                text = `${t('cars.unassign')} ${t('cars.carLabel', { plateNumber: log.targetName || '', plateCode: '', emirate: '' })}`;
            } else if (log.actionType === 'LOGIN') {
                text = t('dash.loggedIn');
            } else if (log.actionType === 'LOGOUT') {
                text = t('dash.loggedOut');
            } else if (log.actionType === 'REQUEST_LINK') {
                text = `${t('requests.typeLink')} ${t('cars.carLabel', { plateNumber: log.targetName || '', plateCode: '', emirate: '' })}`;
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
        timeline.innerHTML = `<p class="error">${t('error.general')}</p>`;
    }
}