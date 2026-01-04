import React, { useState } from 'react';
import Sidebar from './Sidebar';

export default function TopBar({ title, links = [], profileLink, onLogout, logoutLabel = 'Logout', sessionInfo }) {
  const [open, setOpen] = useState(false);

  // Fixed header + spacer to avoid overlaying page content
  return (
    <>
      <div className="w-full bg-white shadow-md fixed left-0 right-0 top-0 z-50">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            <button className="md:hidden px-2 py-1 rounded hover:bg-gray-100" aria-label="Open menu" onClick={() => setOpen(true)}>☰</button>
            <h1 className="text-xl font-bold">{title}</h1>
            {sessionInfo && (
              <span className="text-xs px-2 py-1 bg-gray-100 border rounded text-gray-600">{sessionInfo}</span>
            )}
          </div>

          <div className="hidden md:flex space-x-4 mx-auto overflow-x-auto max-w-full">
            {links.map((link, idx) => (
              <div key={idx} className="relative min-w-0">
                <button
                  className="px-3 py-1 hover:bg-gray-200 rounded whitespace-nowrap"
                  onClick={link.onClick}
                >
                  {link.label}
                </button>
                {link.alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {link.alertCount}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* hide profile button on small screens; available in Sidebar */}
            {profileLink && (
              <div className="hidden md:block">
                <button
                  className="px-3 py-1 hover:bg-gray-200 rounded"
                  onClick={profileLink.onClick}
                >
                  {profileLink.label}
                </button>
              </div>
            )}

            {onLogout && (
              <button className="px-3 py-1 hover:bg-gray-200 rounded text-red-600" onClick={onLogout}>
                {logoutLabel}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* spacer to prevent fixed header overlap */}
      <div aria-hidden className="h-14" />

      <Sidebar open={open} onClose={() => setOpen(false)} title={title} links={links} profileLink={profileLink} onLogout={onLogout} sessionInfo={sessionInfo} />
    </>
  );
}
