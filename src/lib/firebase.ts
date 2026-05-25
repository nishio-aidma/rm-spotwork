import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// --- ここから下にコピーしたConfigをそのまま貼り付け ---
const firebaseConfig = {
  apiKey: "AIzaSyBRR1L-yHfKrZcMxwtMWqr7h3hcDE5iX7Q",
  authDomain: "my-gyomu-app.firebaseapp.com",
  projectId: "my-gyomu-app",
  storageBucket: "my-gyomu-app.firebasestorage.app",
  messagingSenderId: "811789054356",
  appId: "1:811789054356:web:f3a7b957894c33a42b5f81"
};
// --- ここまで ---

// Firebaseの初期化（二重に初期化されないようにする設定）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
