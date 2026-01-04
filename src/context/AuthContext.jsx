import { createContext, useContext, useEffect, useState } from "react";
import { auth as firebaseAuth, db } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({ role: null, uid: null });
  const [storageType, setStorageType] = useState('local'); // 'local' | 'session' | 'none'
  const [initialized, setInitialized] = useState(false);

  const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
  const ACTIVITY_POLL_INTERVAL = 60 * 1000; // check every minute

  // Load from sessionStorage (tab-only) first, then localStorage
  useEffect(() => {
    const s = sessionStorage.getItem('sessionAuth');
    if (s) {
      setAuthState(JSON.parse(s));
      setStorageType('session');
      return;
    }

    const stored = localStorage.getItem('authData');
    if (stored) setAuthState(JSON.parse(stored));
  }, []);

  // Sync with Firebase Auth state and fetch role from Firestore so refresh persists
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!user) {
        setInitialized(true);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setAuthState({ role: data.role || null, uid: user.uid });
        } else {
          // fallback to stored state
          const stored = localStorage.getItem("authData");
          if (stored) setAuthState(JSON.parse(stored));
        }
      } catch (e) {
        console.error('Failed to sync auth state', e);
      } finally {
        setInitialized(true);
      }
    });

    return () => unsub();
  }, []);

  // On mount, if last active exceeded, clear auth
  useEffect(() => {
    const last = Number(localStorage.getItem('authLastActive')) || 0;
    if (last && Date.now() - last > INACTIVITY_LIMIT_MS) {
      // expired
      localStorage.removeItem('authData');
      sessionStorage.removeItem('sessionAuth');
      localStorage.removeItem('authLastActive');
      setAuthState({ role: null, uid: null });
    }
  }, []);

  // Auto-store according to chosen storageType
  useEffect(() => {
    if (authState.role && authState.uid) {
      if (storageType === 'session') {
        sessionStorage.setItem('sessionAuth', JSON.stringify(authState));
        localStorage.removeItem('authData');
      } else if (storageType === 'local') {
        localStorage.setItem('authData', JSON.stringify(authState));
        sessionStorage.removeItem('sessionAuth');
      }

      // ensure we have a last active timestamp in localStorage
      if (!localStorage.getItem("authLastActive")) {
        localStorage.setItem("authLastActive", String(Date.now()));
      }
    } else {
      localStorage.removeItem("authData");
      sessionStorage.removeItem('sessionAuth');
      localStorage.removeItem("authLastActive");
    }
  }, [authState, storageType]);

  // login with persistence option
  const login = (role, uid, persist = 'local') => {
    setAuthState({ role, uid });
    setStorageType(persist);
  };

  const logout = () => {
    // Sign out from Firebase auth as well (best-effort)
    try { signOut(firebaseAuth).catch(() => {}); } catch (e) {}
    setAuthState({ role: null, uid: null });
    localStorage.removeItem("authData");
    sessionStorage.removeItem('sessionAuth');
    localStorage.removeItem("authLastActive");
  };

  // Activity tracking: update last-active timestamp on user interaction
  useEffect(() => {
    const update = () => localStorage.setItem("authLastActive", String(Date.now()));

    const props = ["mousemove", "mousedown", "keydown", "touchstart", "visibilitychange"];
    props.forEach(p => window.addEventListener(p, update));

    const interval = setInterval(() => {
      const stored = localStorage.getItem("authLastActive");
      if (!stored || !authState.uid) return;
      const last = Number(stored);
      if (Date.now() - last > INACTIVITY_LIMIT_MS) {
        // auto logout on inactivity
        setAuthState({ role: null, uid: null });
        localStorage.removeItem("authData");
        sessionStorage.removeItem('sessionAuth');
        localStorage.removeItem("authLastActive");
        try { signOut(firebaseAuth).catch(() => {}); } catch (e) {}
      }
    }, ACTIVITY_POLL_INTERVAL);

    return () => {
      props.forEach(p => window.removeEventListener(p, update));
      clearInterval(interval);
    };
  }, [authState.uid]);

  return (
    <AuthContext.Provider value={{ auth: authState, login, logout, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
