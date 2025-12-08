import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { collection, getDocs, doc, setDoc, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    try {
      const adminQuery = query(collection(db, "users"), where("role", "==", "admin"));
      const snap = await getDocs(adminQuery);

      let userCred;

      if (snap.empty) {
        // First admin ever → signup permitted
        userCred = await createUserWithEmailAndPassword(auth, email, password);

        await setDoc(doc(db, "users", userCred.user.uid), {
          email,
          role: "admin",
          createdAt: new Date(),
        });

      } else {
        // Admin exists → login only
        userCred = await signInWithEmailAndPassword(auth, email, password);
      }

      login("admin", userCred.user.uid);
      navigate("/admin/dashboard");

    } catch (err) {
      alert(err.message);
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
    </div>
  );
}
