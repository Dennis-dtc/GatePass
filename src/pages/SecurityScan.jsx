import React, { useState } from "react";
import Scanner from "../components/Scanner";
import DeviceCard from "../components/DeviceCard";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp
} from "firebase/firestore";

export default function SecurityScan({ securityUID, securityName }) {
  const [scanning, setScanning] = useState(true);
  const [current, setCurrent] = useState(null);

  async function onDetected(text) {
    try {
      const parsed = JSON.parse(text); // { deviceID, ownerUID }
      const ref = doc(db, "devices", parsed.deviceID);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        alert("Device not found");
        setScanning(true);
        return;
      }

      setCurrent({
        parsed,
        device: { id: snap.id, ...snap.data() }
      });
      setScanning(false);
    } catch (e) {
      console.warn("Invalid QR:", e);
      setScanning(true);
    }
  }

  async function verifyManual(sn) {
    if (!current) return;

    const { device } = current;
    const ref = doc(db, "devices", device.id);
    const isMatch = device.deviceSN === sn;

    await updateDoc(ref, {
      status: isMatch ? "in_school" : device.status,
      lastVerifiedAt: serverTimestamp(),
      lastVerifiedBy: securityUID,
      snMismatch: isMatch ? false : true
    });

    await addDoc(collection(db, "logs"), {
      deviceID: device.id,
      ownerUID: device.ownerUID,
      scannedSN: sn,
      expectedSN: device.deviceSN,
      isMatch,
      securityUID,
      securityName,
      timestamp: serverTimestamp()
    });

    alert(isMatch ? "Verified — In School" : "Mismatch logged");

    setCurrent(null);
    setScanning(true);
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold mb-4">Gate • Device Scanner</h1>

      {scanning && (
        <Scanner
          continuous={false}
          onDetected={onDetected}
          onClose={() => {}}
        />
      )}

      {!scanning && current && (
        <div className="mt-6 p-4 bg-white rounded-xl shadow-md">
          <DeviceCard device={current.device} />

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              Enter SN observed on laptop
            </label>
            <input
              id="manualSN"
              className="p-2 border rounded w-full mt-1"
              placeholder="Type SN shown on laptop"
            />

            <button
              onClick={() =>
                verifyManual(document.getElementById("manualSN").value)
              }
              className="mt-4 bg-blue-600 text-white py-2 px-4 rounded"
            >
              Verify
            </button>

            <button
              onClick={() => {
                setCurrent(null);
                setScanning(true);
              }}
              className="mt-3 bg-gray-500 text-white py-2 px-4 rounded"
            >
              Scan Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
