import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { serverTimestamp } from 'firebase/firestore';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from '../components/Toast';

export default function StudentAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [name, setName] = useState("");

  const [isLogin, setIsLogin] = useState(true);
  const [sessionOnly, setSessionOnly] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const handleSignup = async () => {
    if (!email || !password || !registrationNumber || !name) {
      toast.add("All fields are required", { type: 'error' });
      return;
    }

    try {
      await setPersistence(auth, sessionOnly ? browserSessionPersistence : browserLocalPersistence);
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", userCred.user.uid), {
        email,
        registrationNumber,
        name: name || null,
        role: "student",
        createdAt: new Date(),
      });

      try { await updateDoc(doc(db, 'users', userCred.user.uid), { lastActive: serverTimestamp() }); } catch(e) {}

      login("student", userCred.user.uid, sessionOnly ? 'session' : 'local');  
      navigate("/student/home");

    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        toast.add("Email already registered. Please log in.", { type: 'error' });
        setIsLogin(true);
      } else {
        toast.add(err.message, { type: 'error' });
      }
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast.add("Enter email and password", { type: 'error' });
      return;
    }

    try {
      await setPersistence(auth, sessionOnly ? browserSessionPersistence : browserLocalPersistence);
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "users", userCred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        toast.add("No student record found. Contact admin.", { type: 'error' });
        return;
      }

      const data = snap.data();

      login("student", userCred.user.uid, sessionOnly ? 'session' : 'local');
      try { await updateDoc(doc(db, 'users', userCred.user.uid), { lastActive: serverTimestamp() }); } catch(e) {}
      navigate("/student/home");

    } catch (err) {
      toast.add(err.message, { type: 'error' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">
        {isLogin ? "Student Login" : "Student Signup"}
      </h2>

      {!isLogin && (
        <>
          <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-2 px-4 py-2 border rounded"
          />

          <input
            type="text"
            placeholder="Registration Number"
            value={registrationNumber}
            onChange={(e) => setRegistrationNumber(e.target.value)}
            className="mb-2 px-4 py-2 border rounded"
          />
        </>
      )}

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
        onClick={isLogin ? handleLogin : handleSignup}
        className="px-6 py-2 bg-blue-600 text-white rounded"
      >
        {isLogin ? "Login" : "Signup"}
      </button>

      <p
        className="mt-4 cursor-pointer text-blue-700"
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin ? "Create account?" : "Already have an account?"}
      </p>
      <div className="mt-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={sessionOnly} onChange={e => setSessionOnly(e.target.checked)} />
          <span>Open session in this tab only (don't change other tabs)</span>
        </label>
      </div>
    </div>
  );
}
