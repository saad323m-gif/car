import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDBHHGY_gVpm3NlXThqsC6ojTL9Je4xQ9w",
    authDomain: "car-moving-8b59e.firebaseapp.com",
    databaseURL: "https://car-moving-8b59e-default-rtdb.firebaseio.com",
    projectId: "car-moving-8b59e",
    storageBucket: "car-moving-8b59e.firebasestorage.app",
    messagingSenderId: "332747318494",
    appId: "1:332747318494:web:d5d61cd53f322a182f0e4f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable offline persistence for Spark plan optimization
// Reduces read counts by caching data locally
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence failed: Multiple tabs open.');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence not supported in this browser.');
        } else {
            console.warn('Firestore persistence error:', err.message);
        }
    });
} catch (e) {
    console.warn('Persistence init error:', e);
}

export { app, auth, db, firebaseConfig };