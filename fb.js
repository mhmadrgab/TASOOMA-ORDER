// إعدادات Firebase لمشروع TASOOMA (مشتركة بين صفحة الفرع وصفحة المستودع)
import {initializeApp,getApps} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {getFirestore,collection,doc,addDoc,setDoc,getDoc,updateDoc,deleteDoc,onSnapshot,query,where} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {getAuth,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
const firebaseConfig = {
  apiKey: "AIzaSyDSMJmTT9Ed3hQYIe2zGhEUKKt0qTL3ZwM",
  authDomain: "tasooma-ad4fe.firebaseapp.com",
  projectId: "tasooma-ad4fe",
  storageBucket: "tasooma-ad4fe.firebasestorage.app",
  messagingSenderId: "463966731953",
  appId: "1:463966731953:web:6b43696b49837494d82c90"
};
export const DOMAIN="tasooma.app";
export const ADMIN_EMAIL="mohamedrgab20@gmail.com";
export const emailOf=c=>`${c}@${DOMAIN}`;
// كل صفحة بتفتح "تطبيق" باسم مختلف علشان جلسة الدخول ما تتخلطش (فرع / مستودع / إنشاء حسابات)
export function makeFb(name){
  const app=getApps().find(a=>a.name===name)||initializeApp(firebaseConfig,name);
  return {app,db:getFirestore(app),auth:getAuth(app)};
}
export const withTimeout=(p,ms=15000)=>Promise.race([p,new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")),ms))]);
export {collection,doc,addDoc,setDoc,getDoc,updateDoc,deleteDoc,onSnapshot,query,where,signInWithEmailAndPassword,createUserWithEmailAndPassword,signOut,onAuthStateChanged,updatePassword};
