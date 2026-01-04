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
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  setDoc
} from "firebase/firestore";
import { useToast } from "../components/Toast";
import FlagModal from '../components/FlagModal';

export default function SecurityScan({ securityUID, securityName }) {
  const [scanning, setScanning] = useState(true);
  const [current, setCurrent] = useState(null);
  const toast = useToast();
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagTarget, setFlagTarget] = useState(null);
  const [flagContext, setFlagContext] = useState(null);
  const [flagDefaultSN, setFlagDefaultSN] = useState('');

  async function onDetected(text) {
    try {
      const parsed = JSON.parse(text); // { deviceID, ownerUID }
      const ref = doc(db, "devices", parsed.deviceID);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        toast.add("Device not found", { type: 'error' });
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
      // if device was already in_school and we verify again, treat as an exit
      status: isMatch ? (device.status === 'in_school' ? 'out' : 'in_school') : device.status,
      lastVerifiedAt: serverTimestamp(),
      lastVerifiedBy: securityUID,
      snMismatch: isMatch ? false : true
    });

    // record action: 'in' for entry, 'out' for exit, 'mismatch' for mismatch/flag
    const action = isMatch ? (device.status === 'in_school' ? 'out' : 'in') : 'mismatch';

    await addDoc(collection(db, "logs"), {
      deviceID: device.id,
      ownerUID: device.ownerUID,
      scannedSN: sn,
      expectedSN: device.deviceSN,
      isMatch,
      action,
      securityUID,
      securityName,
      timestamp: serverTimestamp()
    });

    if (isMatch) {
      toast.add('Verified — In School', { type: 'success' });
      setCurrent(null);
      setScanning(true);
    } else {
      // prepare flagging flow: keep context and open FlagModal to capture reason/serial
      setFlagContext({ deviceId: device.id, ownerUID: device.ownerUID, expectedSN: device.deviceSN, scannedSN: sn });
      setFlagTarget(device.id);
      setFlagDefaultSN(sn || '');
      setShowFlagModal(true);
    }
  }

  const handleFlagSubmit = async ({ reason, serial }) => {
    if (!flagTarget) return;
    try {
      await updateDoc(doc(db, 'devices', flagTarget), {
        snMismatch: true,
        flagged: true,
        flagReason: reason || null,
        flaggedSN: serial || null,
        flaggedBy: securityUID || null,
        flaggedAt: serverTimestamp()
      });

      // persist a flag record for history and audit
      try {
        // avoid duplicates by updating an existing flag record if present
        let fsnap = null;
        let didFallbackUpdate = false;

        if (serial) {
          // try to find a serial-specific match first
          const fq = query(collection(db, 'flags'), where('deviceID', '==', flagContext?.deviceId || flagTarget), where('flaggedSN', '==', serial), limit(1));
          const snap1 = await getDocs(fq);
          if (!snap1.empty) fsnap = snap1;
          else {
            // fallback: if there's an existing flag for this device (no serial), update it rather than creating a duplicate
            const fq2 = query(collection(db, 'flags'), where('deviceID', '==', flagContext?.deviceId || flagTarget), limit(1));
            const snap2 = await getDocs(fq2);
            if (!snap2.empty) {
              const fdoc = snap2.docs[0];
              try {
                await updateDoc(doc(db, 'flags', fdoc.id), {
                  flaggedSN: serial || fdoc.data().flaggedSN || null,
                  flagReason: reason || fdoc.data().flagReason || null,
                  flaggedBy: securityUID || fdoc.data().flaggedBy || null,
                  flaggedByName: securityName || fdoc.data().flaggedByName || null,
                  flaggedAt: serverTimestamp(),
                  status: 'open',
                  resolvedAt: null,
                  resolvedBy: null
                });
                toast.add('Updated existing flag record', { type: 'success' });
                console.info('Fallback-updated flag', fdoc.id, 'for device', flagContext?.deviceId || flagTarget);
                didFallbackUpdate = true;
              } catch (ue) { console.error('Failed to fallback-update existing flag record', ue); toast.add('Failed to update flag record: ' + (ue.message || ue), { type: 'error' }); }
            }
          }
        } else {
          const fq = query(collection(db, 'flags'), where('deviceID', '==', flagContext?.deviceId || flagTarget), limit(1));
          fsnap = await getDocs(fq);
        }

        if (didFallbackUpdate) {
          // already updated an existing device-level flag, nothing more to do
        } else if (fsnap && !fsnap.empty) {
          const fdoc = fsnap.docs[0];
          try {
            await updateDoc(doc(db, 'flags', fdoc.id), {
              flaggedSN: serial || fdoc.data().flaggedSN || null,
              flagReason: reason || fdoc.data().flagReason || null,
              flaggedBy: securityUID || fdoc.data().flaggedBy || null,
              flaggedByName: securityName || fdoc.data().flaggedByName || null,
              flaggedAt: serverTimestamp(),
              status: 'open',
              resolvedAt: null,
              resolvedBy: null
            });
            toast.add('Updated existing flag record', { type: 'success' });
            console.info('Updated flag', fdoc.id, 'for device', flagContext?.deviceId || flagTarget);
          } catch (ue) { console.error('Failed to update existing flag record', ue); toast.add('Failed to update flag record: ' + (ue.message || ue), { type: 'error' }); }
        } else {
          try {
            const key = `${flagContext?.deviceId || flagTarget}::${serial || '__NONE__'}`;
            await setDoc(doc(db, 'flags', key), {
              deviceID: flagContext?.deviceId || flagTarget,
              ownerUID: flagContext?.ownerUID || null,
              expectedSN: flagContext?.expectedSN || null,
              flaggedSN: serial || null,
              flagReason: reason || null,
              flaggedBy: securityUID || null,
              flaggedByName: securityName || null,
              flaggedAt: serverTimestamp(),
              status: 'open'
            }, { merge: true });
            toast.add('Created/updated flag record', { type: 'success' });
            console.info('Upserted flag', key, 'for device', flagContext?.deviceId || flagTarget);
          } catch (ae) { console.error('Failed to create flag record', ae); toast.add('Failed to create flag record: ' + (ae.message || ae), { type: 'error' }); }
        }
      } catch (e) { console.error('Failed to write flag record', e); }

      // Optionally, add a log entry for the flag
      try {
        await addDoc(collection(db, 'logs'), {
          deviceID: flagContext?.deviceId || flagTarget,
          ownerUID: flagContext?.ownerUID || null,
          scannedSN: flagContext?.scannedSN || null,
          expectedSN: flagContext?.expectedSN || null,
          isMatch: false,
          action: 'mismatch',
          flagged: true,
          flagReason: reason || null,
          flaggedSN: serial || null,
          securityUID,
          securityName,
          timestamp: serverTimestamp()
        });
      } catch (e) { /* ignore logging errors */ }

      toast.add('Mismatch logged and flagged.', { type: 'success' });
    } catch (err) {
      console.error('Flagging failed', err);
      toast.add('Failed to flag device.', { type: 'error' });
    } finally {
      setShowFlagModal(false);
      setFlagTarget(null);
      setFlagContext(null);
      setFlagDefaultSN('');
      setCurrent(null);
      setScanning(true);
    }
  };

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

        {showFlagModal && flagTarget && (
          <FlagModal
            title="Flag Mismatch"
            placeholder="Reason (optional)"
            defaultValue={''}
            defaultSerial={flagDefaultSN}
            onSubmit={(val) => handleFlagSubmit(val)}
            onClose={() => { setShowFlagModal(false); setFlagTarget(null); setFlagContext(null); setFlagDefaultSN(''); setCurrent(null); setScanning(true); }}
          />
        )}
    </div>
  );
}
