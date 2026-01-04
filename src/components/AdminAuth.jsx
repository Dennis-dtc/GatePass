import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { collection, getDocs, doc, setDoc, query, where, updateDoc } from "firebase/firestore";
import { serverTimestamp } from 'firebase/firestore';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from './Toast';

export default function AdminAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionOnly, setSessionOnly] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const handleLogin = async () => {
    if (!email || !password) {
      toast.add("Enter email and password", { type: 'error' });
      return;
    }

    try {
      const adminQuery = query(collection(db, "users"), where("role", "==", "admin"));
      const snap = await getDocs(adminQuery);

      let userCred;

      if (snap.empty) {
        // First admin ever → signup permitted
        await setPersistence(auth, sessionOnly ? browserSessionPersistence : browserLocalPersistence);
        userCred = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(doc(db, "users", userCred.user.uid), {
          email,
          role: "admin",
          createdAt: new Date(),
        });

      } else {
        // Admin exists → login only
        await setPersistence(auth, sessionOnly ? browserSessionPersistence : browserLocalPersistence);
        userCred = await signInWithEmailAndPassword(auth, email, password);
      }

      login("admin", userCred.user.uid, sessionOnly ? 'session' : 'local');
      try { await updateDoc(doc(db, 'users', userCred.user.uid), { lastActive: serverTimestamp() }); } catch(e) {}
      navigate("/admin/dashboard");

    } catch (err) {
      toast.add(err.message, { type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">Admin Login</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-2 px-4 py-2 border rounded"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-4 px-4 py-2 border rounded"
      />

      <button
        onClick={handleLogin}
        className="px-6 py-2 bg-red-600 text-white rounded"
      >
        Login
      </button>
        <div className="mt-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={sessionOnly} onChange={e => setSessionOnly(e.target.checked)} />
            <span>Open session in this tab only (don't change other tabs)</span>
          </label>
        </div>
    </div>
  );
}
