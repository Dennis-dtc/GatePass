// src/components/QRCodeDisplay.jsx
import React from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function QRCodeDisplay({ value, onClose }) {
  // Accept either JSON string or already-stringified value
  let parsed = value;
  try {
    if (typeof value === "string") parsed = JSON.parse(value);
  } catch (e) {
    parsed = value;
  }

  // parsed expected to be like { sn: ["123","456"] }
  const snArray = parsed?.sn || (Array.isArray(parsed) ? parsed : null);

  const qrString = typeof value === "string" ? value : JSON.stringify(parsed);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg flex flex-col items-center">
        <button onClick={onClose} className="self-end mb-4 px-3 py-1 bg-red-500 text-white rounded">X</button>
        <QRCodeCanvas value={qrString} size={300} />

        {snArray && (
          <div className="mt-4 text-center">
            <p className="font-bold">Devices:</p>
            {snArray.map((s, i) => <p key={i} className="text-sm">{s}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
