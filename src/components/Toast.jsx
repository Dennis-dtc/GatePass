import React, { createContext, useContext, useState } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = (message, opts = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    const toast = {
      id,
      message,
      type: opts.type || 'info',
      timeout: opts.timeout ?? 4000
    };

    setToasts(s => [toast, ...s]);

    if (toast.timeout > 0) {
      setTimeout(() => setToasts(s => s.filter(t => t.id !== id)), toast.timeout);
    }
  };

  const remove = (id) => setToasts(s => s.filter(t => t.id !== id));

  return (
    <ToastContext.Provider value={{ add, remove }}>
      {children}

      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`max-w-sm px-4 py-2 rounded shadow-md text-white ${t.type === 'success' ? 'bg-green-600' : t.type === 'error' ? 'bg-red-600' : 'bg-gray-800'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">{t.message}</div>
              <button onClick={() => remove(t.id)} className="text-xs opacity-70">✕</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
