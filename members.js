import { auth, db, firebaseConfig, app } from "./firebase.js";
import { 
    getAuth, createUserWithEmailAndPassword, reauthenticateWithCredential, EmailAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
    query, where, onSnapshot, limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUserData = null;

export const setCurrentUser = (data) => currentUserData = data;
export const getCurrentUser = () => currentUserData;

// Render Dashboard UI
export function renderDashboard() {
    const container = document.getElementById('dashboard-container');
    
    if (currentUserData.role === 'admin') {
        container.innerHTML = `
            <h2>Admin Dashboard</h2>
            <p>Welcome, <strong>${currentUserData.username}</strong></p>
            <button class="btn btn-sm btn-warning" id="edit-profile-btn">Edit My Profile</button>
            
            <div class="divider"></div>
            
            <h3>Add New Member</h3>
            <form id="add-user-form" style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px;">
                <div class="form-group"><label>Username</label><input type="text" id="new-username" required></div>
                <div class="form-group"><label>Email</label><input type="email" id="new-email" required></div>
                <div class="form-group"><label>Password</label><input type="password" id="new-password" required minlength="6"></div>
                <div class="form-group"><label>Phone</label><input type="text" id="new-phone" required pattern="0\\d{9}"></div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label>Role</label>
                    <select id="new-role">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div class="form-group" style="Grid-column: 1 / -1;">
                    <button type="submit" class="btn">Add Member</button>
                </div>
            </form>

            <div class="divider"></div>

            <h3>Members Management</h3>
            <div class="table-container">
                <table id="users-table">
                    <thead>
                        <tr>
                            <th>Username</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="users-tbody"></tbody>
                </table>
            </div>
        `;
        document.getElementById('add-user-form').addEventListener('submit', handleAddUser);
        document.getElementById('edit-profile-btn').addEventListener('click', renderEditProfileForm);
        fetchUsersForAdmin();
    } else {
        container.innerHTML = `
            <h2>User Dashboard</h2>
            <p>Welcome, <strong>${currentUserData.username}</strong></p>
            <p>Your account is active. User features will be available here in future phases.</p>
        `;
    }
}

// Add User Logic
async function handleAddUser(e) {
    e.preventDefault();
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
            username, email, phone, role,
            status: 'active', notes: '',
            isProtected: false, securityPin: null, rememberSession: false
        });

        await secondaryAuth.signOut();
        showMessage('Success: Member added successfully.', 'success', 'dashboard');
        document.getElementById('add-user-form').reset();
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    }
}

// Fetch & Render Members in Table with Dropdown Actions
function fetchUsersForAdmin() {
    const tbody = document.getElementById('users-tbody');
    const q = collection(db, 'users');
    
    onSnapshot(q, (snapshot) => {
        tbody.innerHTML = '';
        snapshot.forEach((d) => {
            const data = d.data();
            const uid = d.id;
            const tr = document.createElement('tr');
            
            let actionsHtml = '';
            if (!data.isProtected) {
                let options = `<option value="">Select Action</option>`;
                if (data.role === 'user') {
                    options += `<option value="promote">Promote to Admin</option>`;
                } else {
                    options += `<option value="demote">Demote to User</option>`;
                }
                if (data.status === 'active') {
                    options += `<option value="suspend">Suspend Account</option>`;
                } else {
                    options += `<option value="activate">Activate Account</option>`;
                }
                options += `<option value="delete">Delete Member</option>`;
                
                actionsHtml = `<select class="action-select" id="action-${uid}">${options}</select>`;
            } else {
                actionsHtml = `<span class="protected-badge">Protected</span>`;
            }

            tr.innerHTML = `
                <td>${data.username}</td>
                <td>${data.email}</td>
                <td>${data.phone}</td>
                <td class="role-${data.role}">${data.role}</td>
                <td class="status-${data.status}">${data.status}</td>
                <td>${actionsHtml}</td>
            `;
            tbody.appendChild(tr);

            if (!data.isProtected) {
                document.getElementById(`action-${uid}`).addEventListener('change', (e) => {
                    handleMemberAction(uid, e.target.value, data.username);
                });
            }
        });
    });
}

// Handle Dropdown Actions
async function handleMemberAction(uid, action, username) {
    if (!action) return;
    
    try {
        if (action === 'promote') await updateDoc(doc(db, 'users', uid), { role: 'admin' });
        else if (action === 'demote') await updateDoc(doc(db, 'users', uid), { role: 'user' });
        else if (action === 'suspend') await updateDoc(doc(db, 'users', uid), { status: 'suspended' });
        else if (action === 'activate') await updateDoc(doc(db, 'users', uid), { status: 'active' });
        else if (action === 'delete') {
            if (!confirm(`Are you sure you want to delete ${username}?`)) return;
            await deleteDoc(doc(db, 'users', uid));
        }
        showMessage('Action completed successfully.', 'success', 'dashboard');
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    }
}

// Super Admin Profile Protection
function renderEditProfileForm() {
    if (!currentUserData.isProtected) {
        showMessage("Only Super Admin can use this secure edit feature.", "warning", 'dashboard');
        return;
    }

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
    const password = document.getElementById('verify-password').value;
    const pin = document.getElementById('verify-pin').value;
    const newUsername = document.getElementById('edit-username').value.trim();
    const newPhone = document.getElementById('edit-phone').value.trim();

    if (pin !== currentUserData.securityPin) return showMessage('Security Error: Invalid Security PIN.', 'error', 'dashboard');
    if (!/^0\d{9}$/.test(newPhone)) return showMessage('Error: Phone must start with 0 and be 10 digits.', 'error', 'dashboard');

    try {
        const credential = EmailAuthProvider.credential(currentUserData.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);

        if (newUsername !== currentUserData.username) {
            const q = query(collection(db, 'users'), where('username', '==', newUsername));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) return showMessage('Error: Username already exists.', 'error', 'dashboard');
        }

        await updateDoc(doc(db, 'users', currentUserData.uid), { username: newUsername, phone: newPhone });
        showMessage('Profile updated successfully. Reloading...', 'success', 'dashboard');
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
        handleFirebaseError(error, 'dashboard');
    }
}

// Error Handler
function handleFirebaseError(error, target = 'auth') {
    let message = '';
    switch (error.code) {
        case 'auth/invalid-email': message = 'Error: The email address is badly formatted.'; break;
        case 'auth/user-not-found': message = 'Error: No user found with this email.'; break;
        case 'auth/wrong-password': message = 'Error: Incorrect password. Please try again.'; break;
        case 'auth/email-already-in-use': message = 'Error: The email is already in use.'; break;
        case 'auth/weak-password': message = 'Error: Password should be at least 6 characters.'; break;
        case 'auth/too-many-requests': message = 'Warning: Too many failed login attempts. Try again later.'; break;
        case 'auth/requires-recent-login': message = 'Error: Please logout and login again before updating profile.'; break;
        default: message = `System Error: ${error.message}`;
    }
    showMessage(message, 'error', target);
}

function showMessage(text, type, target = 'auth') {
    const boxId = target === 'dashboard' ? 'dashboard-message-box' : 'message-box';
    const box = document.getElementById(boxId);
    if (box) {
        box.textContent = text;
        box.className = `message-box ${type}`;
    }
}