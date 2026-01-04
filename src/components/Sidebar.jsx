import React, { useEffect, useRef } from 'react';

export default function Sidebar({ open, onClose, title, links = [], profileLink, onLogout, sessionInfo }) {
  const ref = useRef();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && ref.current) ref.current.focus();
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div className={`fixed inset-0 bg-black transition-opacity ${open ? 'bg-opacity-40 opacity-100' : 'bg-opacity-0 opacity-0 pointer-events-none'}`} onClick={onClose} />

      <aside
        ref={ref}
        tabIndex={-1}
        className={`fixed top-0 left-0 h-full w-72 bg-white shadow-xl transform transition-transform z-50 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg">{title}</h2>
              {sessionInfo && <div className="text-xs text-gray-600">{sessionInfo}</div>}
            </div>
            <button aria-label="Close sidebar" onClick={onClose} className="px-2 py-1 rounded hover:bg-gray-100">✕</button>
          </div>

          <nav className="flex-1 overflow-auto">
            <ul className="flex flex-col gap-2">
              {links.map((l, i) => (
                <li key={i}>
                  <button onClick={() => { onClose(); if (l.onClick) l.onClick(); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100">{l.label}{l.alertCount ? <span className="ml-2 inline-block bg-red-500 text-white rounded-full text-xs px-2">{l.alertCount}</span> : null}</button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-4">
            {profileLink && <button onClick={() => { onClose(); profileLink.onClick && profileLink.onClick(); }} className="w-full text-left px-3 py-2 rounded hover:bg-gray-100">{profileLink.label}</button>}
            {onLogout && <button onClick={() => { onClose(); onLogout(); }} className="w-full mt-2 px-3 py-2 rounded bg-red-600 text-white">Logout</button>}
          </div>
        </div>
      </aside>
    </>
  );
}
