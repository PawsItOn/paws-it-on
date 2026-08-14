import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD4zUgjOLEcz1GZfXKEOEbfmisvWRXpgVc",
  authDomain: "paws-it-on.firebaseapp.com",
  projectId: "paws-it-on",
  storageBucket: "paws-it-on.firebasestorage.app",
  messagingSenderId: "789680031473",
  appId: "1:789680031473:web:d70951109bb03c4f6a4b50",
  measurementId: "G-C5JVL0JP8M"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
