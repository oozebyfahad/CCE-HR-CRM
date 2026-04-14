import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyD3kQ3lR2RslIscNAHbBJgaGp4fdVRPd5w",
  authDomain: "cabcall---crm.firebaseapp.com",
  projectId: "cabcall---crm",
  storageBucket: "cabcall---crm.firebasestorage.app",
  messagingSenderId: "494179550248",
  appId: "1:494179550248:web:1fb54f82894ad02cee611d",
  measurementId: "G-6FE0VYJZZ5"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db   = getFirestore(app)
export default app
