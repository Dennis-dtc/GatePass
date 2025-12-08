import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    role: null, // "student" | "security" | "admin" | null
    uid: null,  // Firebase UID
  });

  // Load from localStorage on refresh
  useEffect(() => {
    const stored = localStorage.getItem("authData");
    if (stored) setAuth(JSON.parse(stored));
  }, []);

  // Auto-store to localStorage
  useEffect(() => {
    if (auth.role && auth.uid) {
      localStorage.setItem("authData", JSON.stringify(auth));
    } else {
      localStorage.removeItem("authData");
    }
  }, [auth]);

  const login = (role, uid) => {
    setAuth({ role, uid });
  };

  const logout = () => {
    setAuth({ role: null, uid: null });
    localStorage.removeItem("authData");
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
