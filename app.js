let auth, db;

window.addEventListener('firebaseReady', async () => {
    const { getAuth, getFirestore } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js")
    .catch(() => ({
        getAuth: () => window.firebaseServices.auth,
        getFirestore: () => window.firebaseServices.db
    }));

    auth = window.firebaseServices.auth;
    db = window.firebaseServices.db;

    updateDateTime();
    setInterval(updateDateTime, 1000);

    await checkSystemState();
});

// Real-time UAE Date and Time (English numerals only)
function updateDateTime() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    document.getElementById('datetime').textContent = formatter.format(now);
}

// Check if Super Admin exists to show Setup or Login form
async function checkSystemState() {
    const formContainer = document.getElementById('form-container');
    
    try {
        const { collection, getDocs, limit, query } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const q = query(collection(db, 'users'), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            renderSetupForm();
        } else {
            renderLoginForm();
        }
    } catch (error) {
        showMessage(`System Error: ${error.message}`, 'error');
    }
}

// Render First Time Setup Form (Super Admin)
function renderSetupForm() {
    const formContainer = document.getElementById('form-container');
    formContainer.innerHTML = `
        <h2>System Setup</h2>
        <p style="margin-bottom: 20px; font-size: 0.9rem; color: #666;">Create the protected Super Admin account.</p>
        <form id="setup-form">
            <div class="form-group">
                <label>Username</label>
                <input type="text" id="username" required>
            </div>
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="email" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="password" required minlength="6">
            </div>
            <div class="form-group">
                <label>Phone (Starts with 0, 10 digits)</label>
                <input type="text" id="phone" required pattern="0\\d{9}" title="Must start with 0 and be 10 digits">
            </div>
            <div class="form-group">
                <label>Security PIN (4 digits)</label>
                <input type="password" id="securityPin" required pattern="\\d{4}" title="Must be 4 digits">
            </div>
            <button type="submit" class="btn">Create Super Admin</button>
        </form>
    `;

    document.getElementById('setup-form').addEventListener('submit', handleSetup);
}

// Handle Super Admin Creation
async function handleSetup(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone').value.trim();
    const securityPin = document.getElementById('securityPin').value;

    // Validation
    if (!/^0\d{9}$/.test(phone)) return showMessage('Error: Phone must start with 0 and be exactly 10 digits.', 'error');
    if (!/^\d{4}$/.test(securityPin)) return showMessage('Error: Security PIN must be exactly 4 digits.', 'error');

    try {
        const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        const { doc, setDoc, collection, getDocs, query, where } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        // Check Username Uniqueness
        const q = query(collection(db, 'users'), where('username', '==', username));
        const usernameSnapshot = await getDocs(q);
        if (!usernameSnapshot.empty) return showMessage('Error: Username already exists.', 'error');

        // Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // Create Firestore Document
        await setDoc(doc(db, 'users', uid), {
            username: username,
            email: email,
            phone: phone,
            role: 'admin',
            status: 'active',
            notes: '',
            isProtected: true,
            securityPin: securityPin,
            rememberSession: false
        });

        showMessage('Success: Super Admin created. Redirecting...', 'success');
        setTimeout(() => window.location.reload(), 2000);

    } catch (error) {
        handleFirebaseError(error);
    }
}

// Render Standard Login Form
function renderLoginForm() {
    const formContainer = document.getElementById('form-container');
    formContainer.innerHTML = `
        <h2>Login</h2>
        <form id="login-form">
            <div class="form-group">
                <label>Email</label>
                <input type="email" id="login-email" required>
            </div>
            <div class="form-group">
                <label>Password</label>
                <input type="password" id="login-password" required>
            </div>
            <div class="form-group checkbox-group">
                <input type="checkbox" id="remember-me">
                <label for="remember-me" style="margin-bottom:0">Remember Me</label>
            </div>
            <button type="submit" class="btn">Login</button>
        </form>
    `;

    document.getElementById('login-form').addEventListener('submit', handleLogin);
}

// Handle User Login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me').checked;

    try {
        const { signInWithEmailAndPassword, browserLocalPersistence, browserSessionPersistence } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        const { doc, getDoc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");

        // Set Persistence based on Remember Me (Interface level)
        await auth.setPersistence(rememberMe ? browserLocalPersistence : browserSessionPersistence);

        // Sign In
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;

        // Fetch Firestore Data
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (!userDoc.exists()) {
            showMessage('Error: User data not found. Contact admin.', 'error');
            return;
        }

        const userData = userDoc.data();

        // Check Suspension Status
        if (userData.status === 'suspended') {
            const { signOut } = await import("https://www.gstatic.com/firebasejs/4.4/firebase-auth.js");
            await signOut(auth);
            showMessage('Access Denied: Your account is suspended.', 'error');
            return;
        }

        // Update Remember Me in Database
        await updateDoc(doc(db, 'users', uid), {
            rememberSession: rememberMe
        });

        showMessage('Login Successful. Redirecting...', 'success');
        // Redirect to dashboard will go here in next phase

    } catch (error) {
        handleFirebaseError(error);
    }
}

// Detailed Error Handling
function handleFirebaseError(error) {
    let message = '';
    switch (error.code) {
        case 'auth/invalid-email':
            message = 'Error: The email address is badly formatted.';
            break;
        case 'auth/user-disabled':
            message = 'Error: This user has been disabled.';
            break;
        case 'auth/user-not-found':
            message = 'Error: No user found with this email.';
            break;
        case 'auth/wrong-password':
            message = 'Error: Incorrect password. Please try again.';
            break;
        case 'auth/email-already-in-use':
            message = 'Error: The email is already in use by another account.';
            break;
        case 'auth/weak-password':
            message = 'Error: Password should be at least 6 characters.';
            break;
        case 'auth/too-many-requests':
            message = 'Warning: Too many failed login attempts. Try again later.';
            break;
        case 'auth/network-request-failed':
            message = 'Error: Network error. Check your internet connection.';
            break;
        default:
            message = `System Error: ${error.message}`;
    }
    showMessage(message, 'error');
}

// UI Message Renderer
function showMessage(text, type) {
    const box = document.getElementById('message-box');
    box.textContent = text;
    box.className = `message-box ${type}`;
}
