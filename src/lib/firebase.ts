import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDvpROrcpDxv5AY2puAMW2aZChu44zioD4",
  authDomain: "mistbound-8511c.firebaseapp.com",
  projectId: "mistbound-8511c",
  storageBucket: "mistbound-8511c.firebasestorage.app",
  messagingSenderId: "620187709098",
  appId: "1:620187709098:web:e3953b6429ee2054c2ead3",
  measurementId: "G-4W7K0R4G2D"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  hd: 'tsunjin.edu.my'
});

export { auth, db, provider };
