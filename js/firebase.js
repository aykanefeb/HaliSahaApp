import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCHJa9W8UtESJyJMAR1f60gh5Rw35SfCCs",
    authDomain: "regista-bd253.firebaseapp.com",
    projectId: "regista-bd253",
    storageBucket: "regista-bd253.firebasestorage.app",
    messagingSenderId: "800859981775",
    appId: "1:800859981775:web:a78ec7700966198e70b4ba"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
