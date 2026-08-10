import { auth, db, firebaseConfig } from "./firebase.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, doc, setDoc, getDoc, getDocs, updateDoc, query, where, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAction } from "./logs.js";

let currentUserData = null;
let lastVisibleUser = null;

export const setCurrentUser = (data) => currentUserData = data;
export const getCurrentUser = () => currentUserData;

export function renderDashboard() {
    if (!currentUserData || currentUserData.role !== 'admin') {
        document.getElementById('dashboard-container').innerHTML = '<h2>Access Denied</h2><p>You do not have permission to view this page.</p>';
        return;
    }

    const container = document.getElementById('dashboard-container');
    container.innerHTML = `
        <div class="dashboard-header">
            <h2>Admin Dashboard</h2>
            <p>Welcome, <strong>${currentUserData.username}</strong></p>
            <button class="btn btn-sm btn-warning" id="edit-profile-btn" style="margin-top: 10px;">Edit My Profile</button>
        </div>
        <div class="divider"></div>
        <button class="btn-add-toggle" id="toggle-add-member">+ Add New Member</button>
        <div id="add-member-form-wrapper" class="hidden-form" style="margin-bottom: 30px;">
            <form id="add-user-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="form-group"><label>Username</label><input type="text" id="new-username" required></div>
                <div class="form-group"><label>Email</label><input type="email" id="new-email" required></div>
                <div class="form-group"><label>Password</label><input type="password" id="new-password" required minlength="6"></div>
                <div class="form-group"><label>Phone</label><input type="text" id="new-phone" required pattern="0\\d{9}"></div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Role</label>
                    <select id="new-role"><option value="user">User</option><option value="admin">Admin</option></select>
                </div>
                <div class="form-group" style="Grid-column: 1 / -1;"><button type="submit" class="btn">Add Member</button></div>
            </form>
        </div>
        <h3>Members Management</h3>
        <div id="users-card-list" class="card-list"><p class="loading-text">Loading members...</p></div>
        <div id="load-more-container" class="load-more-container"></div>
    `;
    
    document.getElementById('toggle-add-member').addEventListener('click', () => {
        document.getElementById('add-member-form-wrapper').classList.toggle('hidden-form');
    });
    document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
    document.getElementById('edit-profile-btn').addEventListener('click', renderEditProfileForm);
    
    lastVisibleUser = null;
    fetchUsersForAdmin(false);
}

async function handleAddUser(e) {
    e.preventDefault();
    if (currentUserData.role !== 'admin') return;
    
    const username = document.getElementById('new-username').value.trim();
    const email = document.getElementById('new-email').value.trim();
    const password = document.getElementById('new-password').value;
    const phone = document.getElementById('new-phone').value.trim();
    const role = document.getElementById('new-role').value;

    if (!/^0\d{9}$/.test(phone)) return showMessage('Error: Phone must start with 0 and be 10 digits.', 'error', 'dashboard');

    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return showMessage('Error: Username already exists.', 'error', 'dashboard');

        const secondaryApp = initializeApp(firebaseConfig, "Secondary");
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const uid = userCredential.user.uid;

        await setDoc(doc(db, 'users', uid), {
            username, email, phone, role, status: 'active', notes: '', isProtected: false, securityPin: null, rememberSession: false
        });

        await secondaryAuth.signOut();
        await logAction(currentUserData, 'CREATE_USER', { targetId: uid, targetName: username, text: `Created new ${role}: ${username}` });
        
        showMessage('Success: Member added successfully.', 'success', 'dashboard');
        document.getElementById('add-user-form').reset();
        document.getElementById('add-member-form-wrapper').classList.add('hidden-form');
        lastVisibleUser = null;
        fetchUsersForAdmin(false);
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    }
}

async function fetchUsersForAdmin(loadMore = false) {
    if (currentUserData.role !== 'admin') return;
    
    const listContainer = document.getElementById('users-card-list');
    const loadMoreContainer = document.getElementById('load-more-container');
    
    if (!loadMore) listContainer.innerHTML = '<p class="loading-text">Loading members...</p>';

    try {
        let q = (loadMore && lastVisibleUser) ? query(collection(db, 'users'), startAfter(lastVisibleUser), limit(10)) : query(collection(db, 'users'), limit(10));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            if (!loadMore) listContainer.innerHTML = '<p style="text-align:center; color:#666;">No members found.</p>';
            loadMoreContainer.innerHTML = '';
            return;
        }

        lastVisibleUser = snapshot.docs[snapshot.docs.length - 1];
        if (!loadMore) listContainer.innerHTML = '';

        snapshot.forEach((d) => renderUserCard(d.id, d.data()));

        if (snapshot.size === 10) {
            loadMoreContainer.innerHTML = '<button class="load-more-btn" id="load-more-btn">Load More</button>';
            document.getElementById('load-more-btn').addEventListener('click', () => fetchUsersForAdmin(true));
        } else { loadMoreContainer.innerHTML = ''; }
    } catch (error) { handleFirebaseError(error, 'dashboard'); }
}

function renderUserCard(uid, data) {
    const listContainer = document.getElementById('users-card-list');
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${uid}`;
    
    let actionsHtml = '';
    if (!data.isProtected) {
        actionsHtml = `
            <select class="action-select" id="action-${uid}">
                <option value="">Select Action</option>
                <option value="edit">Edit Member</option>
                <option value="activity">View Activity Log</option>
                ${data.role === 'user' ? '<option value="promote">Promote</option>' : '<option value="demote">Demote</option>'}
                ${data.status === 'active' ? '<option value="suspend">Suspend</option>' : '<option value="activate">Activate</option>'}
            </select>
            <div id="activity-area-${uid}" style="margin-top: 15px; display: none;"></div>
        `;
    } else { 
        actionsHtml = `
            <select class="action-select" id="action-${uid}">
                <option value="">Select Action</option>
                <option value="activity">View Activity Log</option>
            </select>
            <div id="activity-area-${uid}" style="margin-top: 15px; display: none;"></div>
        `; 
    }

    card.innerHTML = `
        <div class="card-header" id="header-${uid}">
            <span class="card-title">${data.username}</span>
            <div class="card-meta">
                <span class="role-${data.role}">${data.role}</span>
                <span class="status-${data.status}">${data.status}</span>
            </div>
        </div>
        <div class="card-body" id="body-${uid}">
            <div id="view-info-${uid}">
                <div class="detail-list">
                    <div class="detail-item"><span class="detail-label">Email</span><span class="detail-value">${data.email}</span></div>
                    <div class="detail-item"><span class="detail-label">Phone</span><span class="detail-value">${data.phone}</span></div>
                    ${currentUserData.role === 'admin' ? `<div class="detail-item" style="grid-column: 1 / -1;"><span class="detail-label">Notes</span><span class="detail-value">${data.notes || 'N/A'}</span></div>` : ''}
                </div>
                <div style="margin-top: 15px;">${actionsHtml}</div>
            </div>
            <div id="edit-form-${uid}" style="display:none;"></div>
        </div>
    `;
    listContainer.appendChild(card);

    document.getElementById(`header-${uid}`).addEventListener('click', (e) => {
        if(e.target.tagName !== 'SELECT' && e.target.tagName !== 'BUTTON' && e.target.tagName !== 'INPUT') {
            card.classList.toggle('open');
        }
    });

    const actionSelect = document.getElementById(`action-${uid}`);
    if (actionSelect) {
        actionSelect.addEventListener('change', (e) => {
            handleMemberAction(uid, e.target.value, data.username);
            e.target.value = "";
        });
    }
}

async function handleMemberAction(uid, action, username) {
    if (currentUserData.role !== 'admin') return;
    if (!action) return;
    
    const activityArea = document.getElementById(`activity-area-${uid}`);
    if (activityArea) activityArea.style.display = 'none';
    
    try {
        if (action === 'promote') { await updateDoc(doc(db, 'users', uid), { role: 'admin' }); await logAction(currentUserData, 'PROMOTE_USER', { targetId: uid, targetName: username, text: `Promoted ${username}` }); }
        else if (action === 'demote') { await updateDoc(doc(db, 'users', uid), { role: 'user' }); await logAction(currentUserData, 'DEMOTE_USER', { targetId: uid, targetName: username, text: `Demoted ${username}` }); }
        else if (action === 'suspend') { await updateDoc(doc(db, 'users', uid), { status: 'suspended' }); await logAction(currentUserData, 'SUSPEND_USER', { targetId: uid, targetName: username, text: `Suspended ${username}` }); }
        else if (action === 'activate') { await updateDoc(doc(db, 'users', uid), { status: 'active' }); await logAction(currentUserData, 'ACTIVATE_USER', { targetId: uid, targetName: username, text: `Activated ${username}` }); }
        else if (action === 'edit') { renderInlineEditForm(uid); return; }
        else if (action === 'activity') { await renderUserActivity(uid); return; }
        
        showMessage(`Action completed for ${username}.`, 'success', 'dashboard');
        lastVisibleUser = null; fetchUsersForAdmin(false);
    } catch (error) { handleFirebaseError(error, 'dashboard'); }
}

// NEW: User-specific Activity Timeline
async function renderUserActivity(uid) {
    const activityArea = document.getElementById(`activity-area-${uid}`);
    if (!activityArea) return;
    activityArea.style.display = 'block';
    activityArea.innerHTML = '<p class="loading-text" style="font-size: 0.85rem;">Loading activity...</p>';

    try {
        // Fetch actions done BY the user
        const actorQ = query(collection(db, 'logs'), where('actorId', '==', uid), limit(20));
        const actorSnap = await getDocs(actorQ);
        
        // Fetch actions done TO the user (Car assignments/unassignments)
        const assigneeQ = query(collection(db, 'logs'), where('assigneeId', '==', uid), limit(20));
        const assigneeSnap = await getDocs(assigneeQ);
        
        let logs = [];
        actorSnap.forEach(d => logs.push(d.data()));
        assigneeSnap.forEach(d => logs.push(d.data()));
        
        // Sort in memory
        logs.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toDate().getTime() : 0;
            const timeB = b.timestamp ? b.timestamp.toDate().getTime() : 0;
            return timeB - timeA;
        });

        if (logs.length === 0) {
            activityArea.innerHTML = '<p style="font-size:0.85rem; text-align:center; color:#666;">No activity recorded.</p>';
            return;
        }

        let html = '<div class="timeline">';
        logs.slice(0, 15).forEach(log => {
            let dateStr = 'Just now';
            if (log.timestamp) {
                dateStr = new Date(log.timestamp.toDate()).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
            }
            
            let itemClass = 'timeline-item';
            let text = log.details;
            
            // Highlight ongoing vs completed assignments
            if (log.actionType === 'CAR_ASSIGN') {
                itemClass += ' ongoing';
                text = `Assigned car <strong>${log.targetId}</strong> (Ongoing)`;
            } else if (log.actionType === 'CAR_UNASSIGN') {
                itemClass += ' completed';
                text = `Unassigned car <strong>${log.targetId}</strong> (Completed)`;
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
        activityArea.innerHTML = `<p class="error" style="font-size:0.85rem;">Error: ${error.message}</p>`;
    }
}

async function renderInlineEditForm(uid) {
    if (currentUserData.role !== 'admin') return;
    
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return;
    const data = userDoc.data();

    document.getElementById(`view-info-${uid}`).style.display = 'none';
    const editArea = document.getElementById(`edit-form-${uid}`);
    editArea.style.display = 'block';
    editArea.innerHTML = `
        <form id="form-edit-${uid}">
            <div class="form-group"><label>Username</label><input type="text" id="edit-un-${uid}" value="${data.username}" required></div>
            <div class="form-group"><label>Email</label><input type="email" id="edit-em-${uid}" value="${data.email}" required></div>
            <div class="form-group"><label>Phone</label><input type="text" id="edit-ph-${uid}" value="${data.phone}" required pattern="0\\d{9}"></div>
            <div class="form-group"><label>Notes (Admin only)</label><input type="text" id="edit-nt-${uid}" value="${data.notes || ''}"></div>
            <button type="submit" class="btn btn-sm">Save Changes</button>
            <button type="button" class="btn btn-sm btn-secondary" id="cancel-edit-${uid}" style="margin-left: 10px;">Cancel</button>
        </form>
    `;

    document.getElementById(`form-edit-${uid}`).addEventListener('submit', async (e) => {
        e.preventDefault();
        const newUsername = document.getElementById(`edit-un-${uid}`).value.trim();
        const newEmail = document.getElementById(`edit-em-${uid}`).value.trim();
        const newPhone = document.getElementById(`edit-ph-${uid}`).value.trim();
        const newNotes = document.getElementById(`edit-nt-${uid}`).value.trim();

        if (!/^0\d{9}$/.test(newPhone)) return showMessage('Error: Phone must be 10 digits starting with 0.', 'error', 'dashboard');

        try {
            await updateDoc(doc(db, 'users', uid), { username: newUsername, email: newEmail, phone: newPhone, notes: newNotes });
            await logAction(currentUserData, 'EDIT_USER', { targetId: uid, targetName: newUsername, text: `Edited details for ${newUsername}` });
            showMessage('Member updated successfully.', 'success', 'dashboard');
            lastVisibleUser = null; fetchUsersForAdmin(false);
        } catch (err) { handleFirebaseError(err, 'dashboard'); }
    });

    document.getElementById(`cancel-edit-${uid}`).addEventListener('click', () => {
        editArea.style.display = 'none';
        document.getElementById(`view-info-${uid}`).style.display = 'block';
    });
}

function renderEditProfileForm() {
    if (!currentUserData || !currentUserData.isProtected) { showMessage("Only Super Admin can use this secure edit feature.", "warning", 'dashboard'); return; }
    document.getElementById('dashboard-container').innerHTML = `
        <h2>Edit Protected Profile</h2>
        <p style="color: #666; margin-bottom: 20px; text-align:center;">Two-step verification required.</p>
        <form id="edit-profile-form" style="max-width: 500px; margin: 0 auto;">
            <div class="form-group"><label>Current Password</label><input type="password" id="verify-password" required></div>
            <div class="form-group"><label>Security PIN (4 digits)</label><input type="password" id="verify-pin" required pattern="\\d{4}"></div>
            <div class="divider"></div>
            <div class="form-group"><label>New Username</label><input type="text" id="edit-username" value="${currentUserData.username}" required></div>
            <div class="form-group"><label>New Phone</label><input type="text" id="edit-phone" value="${currentUserData.phone}" required pattern="0\\d{9}"></div>
            <button type="submit" class="btn">Verify & Update</button>
            <button type="button" class="btn btn-secondary" id="cancel-edit" style="margin-top:10px;">Cancel</button>
        </form>
    `;
    document.getElementById('edit-profile-form').addEventListener('submit', handleEditProtectedProfile);
    document.getElementById('cancel-edit').addEventListener('click', renderDashboard);
}

async function handleEditProtectedProfile(e) {
    e.preventDefault();
    if (!currentUserData.isProtected) return;
    
    const password = document.getElementById('verify-password').value;
    const pin = document.getElementById('verify-pin').value;
    const newUsername = document.getElementById('edit-username').value.trim();
    const newPhone = document.getElementById('edit-phone').value.trim();

    if (pin !== currentUserData.securityPin) return showMessage('Security Error: Invalid Security PIN.', 'error', 'dashboard');
    if (!/^0\d{9}$/.test(newPhone)) return showMessage('Error: Phone must start with 0 and be 10 digits.', 'error', 'dashboard');

    try {
        const { reauthenticateWithCredential, EmailAuthProvider } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        const credential = EmailAuthProvider.credential(currentUserData.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);

        if (newUsername !== currentUserData.username) {
            const q = query(collection(db, 'users'), where('username', '==', newUsername));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) return showMessage('Error: Username already exists.', 'error', 'dashboard');
        }

        await updateDoc(doc(db, 'users', currentUserData.uid), { username: newUsername, phone: newPhone });
        await logAction(currentUserData, 'EDIT_SELF_PROFILE', { targetId: currentUserData.uid, targetName: newUsername, text: 'Super Admin updated own profile' });
        showMessage('Profile updated. Reloading...', 'success', 'dashboard');
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) { handleFirebaseError(error, 'dashboard'); }
}

function handleFirebaseError(error, target = 'auth') {
    let message = '';
    switch (error.code) {
        case 'auth/invalid-email': message = 'Error: The email address is badly formatted.'; break;
        case 'auth/user-not-found': message = 'Error: No user found with this email.'; break;
        case 'auth/wrong-password': message = 'Error: Incorrect password. Please try again.'; break;
        case 'auth/email-already-in-use': message = 'Error: The email is already in use.'; break;
        case 'auth/weak-password': message = 'Error: Password should be at least 6 characters.'; break;
        case 'auth/too-many-requests': message = 'Warning: Too many failed login attempts.'; break;
        case 'auth/requires-recent-login': message = 'Error: Please logout and login again.'; break;
        case 'permission-denied': message = 'Security Error: You do not have permission to perform this action.'; break;
        default: message = `System Error: ${error.message}`;
    }
    showMessage(message, 'error', target);
}

function showMessage(text, type, target = 'auth') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (box) { box.textContent = text; box.className = `message-box ${type}`; }
}