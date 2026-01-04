import React, { useState } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { setPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { serverTimestamp } from 'firebase/firestore';
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from './Toast';
import { signOut } from 'firebase/auth';

export default function SecurityAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [locationID, setLocationID] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [sessionOnly, setSessionOnly] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  const handleSignup = async () => {
    if (!email || !password || !locationID) {
      toast.add("All fields required.", { type: 'error' });
      return;
    }

    try {
      await setPersistence(auth, sessionOnly ? browserSessionPersistence : browserLocalPersistence);
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      // find any pending invite for this email
      const invitesQ = query(collection(db, 'securityInvites'), where('email', '==', email), where('status', '==', 'pending'));
      const invitesSnap = await getDocs(invitesQ);
      let inviteData = null;
      if (!invitesSnap.empty) {
        inviteData = invitesSnap.docs[0];
      }

      const profile = {
        email,
        role: "security",
        locationID: inviteData?.data()?.locationID || locationID,
        name: inviteData?.data()?.name || null,
        createdAt: new Date(),
      };

      await setDoc(doc(db, "users", userCred.user.uid), profile);

      try { await updateDoc(doc(db, 'users', userCred.user.uid), { lastActive: serverTimestamp() }); } catch(e) {}

      if (inviteData) {
        try {
          await updateDoc(inviteData.ref, { status: 'accepted', acceptedAt: new Date(), acceptedBy: userCred.user.uid });
        } catch (e) {}
      }

      if (sessionOnly) {
        try { await signOut(auth); } catch (e) {}
        login('security', userCred.user.uid, 'session');
      } else {
        login('security', userCred.user.uid, 'local');
      }
      navigate("/security/home");

    } catch (err) {
      toast.add(err.message, { type: 'error' });
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
        try { await signOut(auth); } catch (e) {}
        toast.add("Security profile missing. Contact admin.", { type: 'error' });
        return;
      }

      if (sessionOnly) {
        try { await signOut(auth); } catch (e) {}
        login('security', userCred.user.uid, 'session');
      } else {
        login('security', userCred.user.uid, 'local');
      }
      try { await updateDoc(doc(db, 'users', userCred.user.uid), { lastActive: serverTimestamp() }); } catch(e) {}
      navigate("/security/home");

    } catch (err) {
      toast.add(err.message, { type: 'error' });
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

      <div className="mt-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" checked={sessionOnly} onChange={e => setSessionOnly(e.target.checked)} />
          <span>Open session in this tab only (don't change other tabs)</span>
        </label>
      </div>

      <p
        className="mt-4 cursor-pointer text-green-700"
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin ? "Create account?" : "Already have an account?"}
      </p>
    </div>
  );
}
