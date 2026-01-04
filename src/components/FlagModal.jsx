import React, { useState, useEffect } from 'react';

export default function FlagModal({ title = 'Flag', placeholder = '', onSubmit, onClose, defaultValue = '', defaultSerial = '' }) {
  const [text, setText] = useState('');
  const [serial, setSerial] = useState('');
  useEffect(() => { setText(defaultValue); setSerial(defaultSerial || ''); }, [defaultValue, defaultSerial]);

  if (!onSubmit && !onClose) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">X</button>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-gray-700 mb-1">Reason</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder={placeholder} />
        </div>

        <div className="mb-3">
          <label className="block text-sm text-gray-700 mb-1">Serial Number on Device (optional)</label>
          <input value={serial} onChange={(e) => setSerial(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Serial as written on device" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
          <button onClick={() => onSubmit({ reason: text, serial: serial || null })} className="px-4 py-2 bg-red-700 text-white rounded">Submit</button>
        </div>
      </div>
    </div>
  );
}
