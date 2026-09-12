import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyCMevZBBfghFCvRBmb1VzgwhtypgYe2fGA",
  authDomain: "sayarati2.firebaseapp.com",
  projectId: "sayarati2",
  storageBucket: "sayarati2.firebasestorage.app",
  messagingSenderId: "386763287243",
  appId: "1:386763287243:web:85509590193cf768be094e",
  measurementId: "G-PJQ3E74HCK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Firebase App Check
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider('6LfbmkYtAAAAAOJrx6FljxLHMVL69U3kD08BIwrl'),
  isTokenAutoRefreshEnabled: true
});

export { app, auth, db, appCheck, firebaseConfig };
