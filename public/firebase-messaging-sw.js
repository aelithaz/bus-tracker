importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.10/firebase-messaging-compat.js");

const firebaseConfig = {
                apiKey: "AIzaSyBgm7o5xc5y5NM1A1UPZQ3UFtyFjhcvlgI",
                authDomain: "bus-tracker-8fd55.firebaseapp.com",
                projectId: "bus-tracker-8fd55",
                storageBucket: "bus-tracker-8fd55.firebasestorage.app",
                messagingSenderId: "767373776472",
                appId: "1:767373776472:web:0d65379796f1decd749c2d",
                measurementId: "G-892K9T6PET"
              };
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
