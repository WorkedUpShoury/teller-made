import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAkdFwk8qTRTkDePbo8nZRphXq4RIYHyrg",
  authDomain: "teller-made.firebaseapp.com",
  projectId: "teller-made",
  storageBucket: "teller-made.appspot.com",
  messagingSenderId: "475535542277",
  appId: "1:475535542277:web:2ce15c9e87b7b38998f46c",
  measurementId: "G-Q3R3Z8N6D4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();