import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SecurityAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [locationID, setLocationID] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSignup = async () => {
    if (!email || !password || !locationID) {
      alert("All fields required.");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", userCred.user.uid), {
        email,
        role: "security",
        locationID,
        createdAt: new Date(),
      });

      login("security", userCred.user.uid);
      navigate("/security/home");

    } catch (err) {
      alert(err.message);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Enter email and password");
      return;
    }

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "users", userCred.user.uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        alert("Security profile missing. Contact admin.");
        return;
      }

      login("security", userCred.user.uid);
      navigate("/security/home");

    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
      <h2 className="text-2xl font-bold mb-4">
        {isLogin ? "Security Login" : "Security Signup"}
      </h2>

      {!isLogin && (
        <input
          type="text"
          placeholder="Location ID"
          value={locationID}
          onChange={(e) => setLocationID(e.target.value)}
          className="mb-2 px-4 py-2 border rounded w-64"
        />
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-2 px-4 py-2 border rounded w-64"
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-4 px-4 py-2 border rounded w-64"
      />

      <button
        onClick={isLogin ? handleLogin : handleSignup}
        className="px-6 py-2 bg-green-600 text-white rounded"
      >
        {isLogin ? "Login" : "Signup"}
      </button>

      <p
        className="mt-4 cursor-pointer text-green-700"
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin ? "Create account?" : "Already have an account?"}
      </p>
    </div>
  );
}
