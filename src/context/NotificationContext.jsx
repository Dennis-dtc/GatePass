import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertTriangle, Info } from "lucide-react";

/** ------------------------------------------------------
 *  Notification System (REGENERATED CLEAN VERSION)
 *  - Toasts (success, error, warning, info)
 *  - Auto dismiss
 *  - Manual dismiss
 *  - Safe outside-provider usage
 * ------------------------------------------------------ */

const NotificationContext = createContext(null);
let globalId = 0;

export function NotificationProvider({ children, position = "top-right", max = 5 }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef(new Map());

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const remove = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    const t = timersRef.current.get(id);
    if (t) clearTimeout(t);
    timersRef.current.delete(id);
  }, []);

  const notify = useCallback(
    (message, type = "info", duration = 3000) => {
      const id = ++globalId;
      const item = { id, message, type };

      setNotifications((prev) => {
        const next = [...prev, item];
        if (next.length > max) next.shift();
        return next;
      });

      if (duration > 0) {
        const t = setTimeout(() => remove(id), duration);
        timersRef.current.set(id, t);
      }

      return id;
    },
    [max, remove]
  );

  return (
    <NotificationContext.Provider value={{ notify, remove }}>
      {children}
      <NotificationContainer
        position={position}
        notifications={notifications}
        remove={remove}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    console.warn("useNotification called outside NotificationProvider — returning no-op.");
    return {
      notify: () => console.warn("notify() called with no provider"),
      remove: () => console.warn("remove() called with no provider"),
    };
  }
  return ctx;
}

function NotificationContainer({ notifications, remove, position }) {
  const pos = {
    "top-right": "top-6 right-6 items-end",
    "top-left": "top-6 left-6 items-start",
    "bottom-right": "bottom-6 right-6 items-end",
    "bottom-left": "bottom-6 left-6 items-start",
    "top-center": "top-6 left-1/2 -translate-x-1/2 items-center",
    "bottom-center": "bottom-6 left-1/2 -translate-x-1/2 items-center",
  }[position];

  return (
    <div className={`fixed z-50 pointer-events-none flex flex-col gap-3 w-72 ${pos}`}>      
      <AnimatePresence>
        {notifications.map((n) => (
          <NotificationItem key={n.id} {...n} remove={remove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NotificationItem({ id, message, type, remove }) {
  const colors = {
    success: "bg-green-500/90 text-white",
    error: "bg-red-500/90 text-white",
    warning: "bg-yellow-400 text-black",
    info: "bg-sky-500 text-white",
  };

  const icons = {
    success: CheckCircle,
    error: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = icons[type] || Info;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2 }}
      className={`pointer-events-auto p-4 rounded-xl shadow-xl flex gap-3 ${colors[type]}`}
    >
      <div><Icon size={20} /></div>
      <div className="flex-1 text-sm font-medium">{message}</div>
      <button
        onClick={() => remove(id)}
        className="p-1 hover:opacity-70 transition"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}