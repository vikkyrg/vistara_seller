import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAgWE_JutmLJmgIQihIcMl-wHSoNxOYHfY",
  authDomain: "vistara-d6dea.firebaseapp.com",
  projectId: "vistara-d6dea",
  storageBucket: "vistara-d6dea.firebasestorage.app",
  messagingSenderId: "699528287728",
  appId: "1:699528287728:web:197f51eedca7f4f058b935",
  measurementId: "G-4GNTMKC2YL"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
