// إعدادات Firebase لمشروع TASOOMA (مشتركة بين صفحة الفرع وصفحة المستودع)
import {initializeApp} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getFirestore,collection,doc,addDoc,setDoc,getDoc,updateDoc,deleteDoc,onSnapshot,query,where} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const firebaseConfig = {
  apiKey: "AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",
  authDomain: "tasooma-ad4fe.firebaseapp.com",
  projectId: "tasooma-ad4fe",
  storageBucket: "tasooma-ad4fe.firebasestorage.app",
  messagingSenderId: "463966731953",
  appId: "1:463966731953:web:6b43696b49837494d82c90"
};
export const app=initializeApp(firebaseConfig);
export const db=getFirestore(app);
export const sha=async s=>{const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("tasooma|"+s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")};
export const withTimeout=(p,ms=15000)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")),ms))]);
export {collection,doc,addDoc,setDoc,getDoc,updateDoc,deleteDoc,onSnapshot,query,where};
