import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyDBgtEVITygeaqusvxhXWSblNTHD2nUtgM',
  authDomain: 'launch-pad-18192.firebaseapp.com',
  projectId: 'launch-pad-18192',
  storageBucket: 'launch-pad-18192.firebasestorage.app',
  messagingSenderId: '739412058749',
  appId: '1:739412058749:web:9d11ff06a1bf2f802c0714',
  measurementId: 'G-DYL5RTDR2F'
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
