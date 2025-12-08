// src/components/AddDeviceModal.jsx
import React, { useState } from "react";

export default function AddDeviceModal({ onSubmit, onClose }) {
  const [deviceModel, setDeviceModel] = useState("");
  const [deviceSN, setDeviceSN] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!deviceSN || !deviceSN.trim()) return alert("Enter the device serial number (SN).");
    onSubmit({ deviceModel: deviceModel.trim(), deviceSN: deviceSN.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Register Device</h3>
          <button onClick={onClose} className="px-2 py-1 bg-red-500 text-white rounded">X</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-700">Device Serial Number (SN)</label>
            <input
              value={deviceSN}
              onChange={e => setDeviceSN(e.target.value)}
              className="mt-1 w-full p-2 border rounded"
              placeholder="e.g. 12345678"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-700">Device Model (optional)</label>
            <input
              value={deviceModel}
              onChange={e => setDeviceModel(e.target.value)}
              className="mt-1 w-full p-2 border rounded"
              placeholder="e.g. HP ProBook"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Register</button>
          </div>
        </form>
      </div>
    </div>
  );
}
