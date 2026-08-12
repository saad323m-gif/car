import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDBHHGY_gVpm3NlXThqsC6ojTL9Je4xQ9w",
    authDomain: "car-moving-8b59e.firebaseapp.com",
    databaseURL: "https://car-moving-8b59e-default-rtdb.firebaseio.com",
    projectId: "car-moving-8b59e",
    storageBucket: "car-moving-8b59e.firebasestorage.app",
    messagingSenderId: "332747318494",
    appId: "1:332747318494:web:d5d61cd53f322a182f0e4f"
};

let app, auth, db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('Firebase initialized successfully.');
} catch (error) {
    console.error('Firebase initialization failed:', error);
    // عرض رسالة للمستخدم في واجهة HTML
    const formContainer = document.getElementById('form-container');
    if (formContainer) {
        formContainer.innerHTML = `<p style="color:red;text-align:center;">Firebase initialization error: ${error.message}</p>`;
    }
}

export { app, auth, db, firebaseConfig };