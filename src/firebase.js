import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCgQzrS-AZq3wV9bjN1Bg3BVl-Wv-0ZjaI',
  authDomain: 'studentsecurity.firebaseapp.com',
  projectId: 'studentsecurity',
  storageBucket: 'studentsecurity.appspot.com',
  messagingSenderId: '1020075356244',
  appId: '1:1020075356244:web:88d778d63f851ddf0abdc1'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
