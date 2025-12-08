import React from 'react';

export default function TopBar({ title, links = [], profileLink }) {
  return (
    <div className="w-full bg-white shadow-md sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-3">
        <h1 className="text-xl font-bold">{title}</h1>

        <div className="flex space-x-4 mx-auto">
          {links.map((link, idx) => (
            <div key={idx} className="relative">
              <button
                className="px-3 py-1 hover:bg-gray-200 rounded"
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

        <div>
          {profileLink && (
            <button
              className="px-3 py-1 hover:bg-gray-200 rounded"
              onClick={profileLink.onClick}
            >
              {profileLink.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
