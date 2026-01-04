// src/pages/SecurityHome.jsx
import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, getDocs, getDoc, updateDoc, doc, serverTimestamp, addDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import TopBar from "../components/TopBar";
import DeviceCard from "../components/DeviceCard";
import Scanner from "../components/Scanner";
import QRCodeGenerator from "../components/QRCodeGenerator";
import FlagModal from '../components/FlagModal';
import EditSecurityModal from '../components/EditSecurityModal';

/* Using shared ToastProvider via useToast import */

/* -------------------- Main Component -------------------- */
function SecurityHomeContent() {
  const { auth, logout } = useAuth();
  const securityUID = auth?.uid || null;

  const toast = useToast();

  const [activeTab, setActiveTab] = useState("scan");
  const [scannerMode, setScannerMode] = useState(null);       // null | "qr" | "sticker"
  const [scannedResults, setScannedResults] = useState(null); // array of found devices
  const [allowedDevices, setAllowedDevices] = useState([]);
  const [securityUser, setSecurityUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [qrGeneratorDevice, setQrGeneratorDevice] = useState(null); // device for QR generation modal
  const [manualInput, setManualInput] = useState("");
  const [flagTarget, setFlagTarget] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  /* -------------------- Load allowed devices -------------------- */
  useEffect(() => {
    const q = query(collection(db, "devices"), where("status", "==", "in_school"));
    const unsub = onSnapshot(q, (snap) => {
      setAllowedDevices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  /* -------------------- Load profile -------------------- */
  useEffect(() => {
    if (!securityUID) return;
    const ref = doc(db, "users", securityUID);

    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) setSecurityUser({ id: snap.id, ...snap.data() });
    });

    return () => unsub();
  }, [securityUID]);

  /* -------------------- Scanner handlers -------------------- */
  const onScannerDetected = async (text) => {
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {}

    let snList = [];
    let reg = null;

    if (parsed) {
      if (parsed.sn) snList = Array.isArray(parsed.sn) ? parsed.sn : [parsed.sn];
      reg = parsed.registrationNumber || parsed.reg || null;
    }

    if (snList.length === 0) snList = [text];

    let found = [];

    try {
      if (snList.length <= 10) {
        const q = query(collection(db, "devices"), where("deviceSN", "in", snList));
        const snap = await getDocs(q);
        found = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } else {
        const all = await getDocs(collection(db, "devices"));
        const list = all.docs.map((d) => ({ id: d.id, ...d.data() }));
        found = list.filter((d) => snList.includes(d.deviceSN));
      }

      if (!found.length && reg) {
        const q2 = query(collection(db, "devices"), where("registrationNumber", "==", reg));
        const snap2 = await getDocs(q2);
        found = snap2.docs.map((d) => ({ id: d.id, ...d.data() }));
      }
    } catch (err) {
      toast.add("Scan failed.", { type: "error" });
      return;
    }

    if (!found.length) {
      toast.add("No registered device found.", { type: "error" });
      return;
    }

    setScannedResults(found);
    setScannerMode(null);
    toast.add(`Found ${found.length} device(s).`, { type: "success" });
  };

  const onStickerDetected = async (text) => {
    try {
      const q = query(collection(db, "devices"), where("deviceSN", "==", text));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.add("Sticker not found.", { type: "error" });
        return;
      }

      const dev = { id: snap.docs[0].id, ...snap.docs[0].data() };
      const newStatus = dev.status === "in_school" ? "out_school" : "in_school";

      await updateDoc(doc(db, "devices", dev.id), {
        status: newStatus,
        lastVerifiedAt: new Date(),
        lastScannedBy: securityUID
      });

      try {
        await addDoc(collection(db, 'logs'), {
          deviceID: dev.id,
          ownerUID: dev.ownerUID || null,
          expectedSN: dev.deviceSN || null,
          isMatch: true,
          action: newStatus === 'in_school' ? 'in' : 'out',
          securityUID,
          securityName: securityUser?.name || securityUser?.email || null,
          timestamp: serverTimestamp()
        });
      } catch (e) { console.error('Failed to write sticker log', e); }

      toast.add(`Device ${text} ${newStatus}.`, { type: "success" });
    } catch {
      toast.add("Sticker scan failed.", { type: "error" });
    }
  };

  const onManualSearch = async () => {
    if (!manualInput || manualInput.trim() === '') {
      toast.add('Enter a serial number or registration number', { type: 'error' });
      return;
    }

    // reuse the scanner detection logic to populate results
    await onScannerDetected(manualInput.trim());
    setManualInput('');
  };

  /* -------------------- Action buttons -------------------- */
  const verifyDevice = async (id) => {
    try {
      const deviceRef = doc(db, 'devices', id);
      const deviceSnap = await getDoc(deviceRef);
      const deviceData = deviceSnap.exists() ? deviceSnap.data() : {};

      await updateDoc(deviceRef, {
        status: "in_school",
        lastVerifiedAt: serverTimestamp(),
        lastScannedBy: securityUID
      });
      // update last active on this security user's profile
      try { await updateDoc(doc(db, 'users', securityUID), { lastActive: serverTimestamp() }); } catch (e) {}
      // write a log entry for clock-in
      try {
        await addDoc(collection(db, 'logs'), {
          deviceID: id,
          ownerUID: deviceData.ownerUID || null,
          expectedSN: deviceData.deviceSN || null,
          isMatch: true,
          action: 'in',
          securityUID,
          securityName: securityUser?.name || securityUser?.email || null,
          timestamp: serverTimestamp()
        });
      } catch (e) { console.error('Failed to write clock-in log', e); }

      toast.add("Clocked in.", { type: "success" });
    } catch (err) {
      console.error("Clock in failed:", err);
      toast.add("Clock in failed.", { type: "error" });
    }
  };

  const clockOutDevice = async (id) => {
    try {
      const deviceRef = doc(db, 'devices', id);
      const devSnap = await getDoc(deviceRef);
      const deviceData = devSnap.exists() ? devSnap.data() : {};

      await updateDoc(deviceRef, {
        status: "out",
        lastVerifiedAt: serverTimestamp(),
        lastScannedBy: securityUID
      });

      try {
        await addDoc(collection(db, 'logs'), {
          deviceID: id,
          ownerUID: deviceData.ownerUID || null,
          expectedSN: deviceData.deviceSN || null,
          isMatch: true,
          action: 'out',
          securityUID,
          securityName: securityUser?.name || securityUser?.email || null,
          timestamp: serverTimestamp()
        });
      } catch (e) { console.error('Failed to write clock-out log', e); }
      toast.add("Clocked out.", { type: "success" });
      try { await updateDoc(doc(db, 'users', securityUID), { lastActive: serverTimestamp() }); } catch (e) {}
    } catch (err) {
      console.error("Clock out failed:", err);
      toast.add("Clock out failed.", { type: "error" });
    }
  };

  const flagMismatch = async (id, payload) => {
    try {
      const reason = payload?.reason || null;
      const serial = payload?.serial || null;
      await updateDoc(doc(db, 'devices', id), {
        snMismatch: true,
        flagged: true,
        flagReason: reason,
        flaggedSN: serial || null,
        flaggedBy: securityUID,
        flaggedAt: serverTimestamp()
      });

      // fetch device data up-front so flag creation below has reliable context
      let deviceData = {};
      try {
        const devSnap = await getDoc(doc(db, 'devices', id));
        deviceData = devSnap.exists() ? devSnap.data() : {};
      } catch (e) {
        console.error('Failed to fetch device data before logging/flagging', e);
      }

      try {
        await addDoc(collection(db, 'logs'), {
          deviceID: id,
          ownerUID: deviceData.ownerUID || null,
          expectedSN: deviceData.deviceSN || null,
          isMatch: false,
          action: 'mismatch',
          flagged: true,
          flagReason: reason || null,
          flaggedSN: serial || null,
          securityUID,
          securityName: securityUser?.name || securityUser?.email || null,
          timestamp: serverTimestamp()
        });
      } catch (e) { console.error('Failed to write mismatch log', e); }

      // ensure a deterministic flag document (avoid race creating duplicates)
      try {
        const key = `${id}::${serial || '__NONE__'}`;
        await setDoc(doc(db, 'flags', key), {
          deviceID: id,
          ownerUID: deviceData.ownerUID || null,
          expectedSN: deviceData.deviceSN || null,
          flaggedSN: serial || null,
          flagReason: reason || null,
          flaggedBy: securityUID || null,
          flaggedByName: securityUser?.name || securityUser?.email || null,
          flaggedAt: serverTimestamp(),
          status: 'open'
        }, { merge: true });
        toast.add('Created/updated flag record', { type: 'success' });
        console.info('Upserted flag', key, 'for device', id);
      } catch (fe) { console.error('Failed to upsert flag record', fe); toast.add('Failed to create/update flag record: ' + (fe.message || fe), { type: 'error' }); }




      toast.add('Device flagged for mismatch.', { type: 'success' });
      try { await updateDoc(doc(db, 'users', securityUID), { lastActive: serverTimestamp() }); } catch (e) {}
    } catch (err) {
      console.error(err);
      toast.add('Failed to flag device.', { type: 'error' });
    } finally {
      setShowFlagModal(false);
      setFlagTarget(null);
      setFlagReason('');
    }
  };

  /* -------------------- UI helpers -------------------- */
  const openQrScanner = () => {
    setScannedResults(null);
    setScannerMode("qr");
  };

  const openStickerScanner = () => {
    setScannedResults(null);
    setScannerMode("sticker");
  };

  const closeScanner = () => {
    setScannerMode(null);
  };

  const filteredAllowed = allowedDevices.filter((d) =>
    (d.registrationNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  

  /* -------------------- Render -------------------- */
  return (
    <div className="min-h-screen bg-gray-100">
        <TopBar
          title="Security Home"
          links={[
            { label: "Scan Device", onClick: () => { setActiveTab("scan"); openQrScanner(); } },
            { label: "Allowed Devices", onClick: () => { setActiveTab("allowed"); setScannerMode(null); } },
            { label: "Profile", onClick: () => { setActiveTab("profile"); setScannerMode(null); } }
          ]}
          onLogout={logout}
          logoutLabel="End Shift"
        />

        <div className="p-6 max-w-6xl mx-auto">
          {/* -------------------- SCAN TAB -------------------- */}
          {activeTab === "scan" && (
            <>
              <div className="flex items-center gap-4 mb-4">
                <button onClick={openQrScanner} className="px-4 py-2 bg-blue-600 text-white rounded">
                  Open Camera Scanner
                </button>

                <button onClick={openStickerScanner} className="px-4 py-2 bg-gray-800 text-white rounded">
                  Open Sticker Scanner
                </button>
              </div>

              {scannedResults && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold mb-3">Scanned Result</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scannedResults.map((d) => (
                      <div key={d.id} className="p-4 bg-white rounded shadow">
                        <DeviceCard device={d} />
                        <div className="mt-3 flex flex-col gap-2">
                          <div className="flex gap-2">
                            <button onClick={() => verifyDevice(d.id)} className="flex-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700">
                              Verify / Clock In
                            </button>

                            <button onClick={() => clockOutDevice(d.id)} className="flex-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                              Clock Out
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setQrGeneratorDevice(d)}
                              className="flex-1 px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                            >
                              Generate QR
                            </button>

                            <button
                              onClick={() => openQrScanner()}
                              className="flex-1 px-3 py-1 bg-blue-200 rounded text-sm hover:bg-blue-300"
                            >
                              Scan Next
                            </button>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => { setFlagTarget(d.id); setShowFlagModal(true); }} className="flex-1 px-3 py-1 bg-red-700 text-white rounded text-sm hover:bg-red-800">Flag Mismatch</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

                        {/* Scanner Mount Area */}
                <div className="w-full h-96 bg-gray-200 rounded overflow-hidden">
                  {scannerMode === "qr" && (
                    <Scanner
                      onDetected={onScannerDetected}
                      onClose={closeScanner}
                      qrbox={260}
                    />
                  )}

                  {scannerMode === "sticker" && (
                    <Scanner
                      onDetected={onStickerDetected}
                      onClose={closeScanner}
                      qrbox={300}
                      continuous={true}
                    />
                  )}

                  {!scannerMode && !scannedResults && (
                    <div className="p-10 text-center text-blue-600">
                      <div>Click a open camera scanner button to begin.</div>
                      <div className="mt-3 flex items-center justify-center gap-2">
                        <input
                          type="text"
                          placeholder="Enter SN or Registration No"
                          value={manualInput}
                          onKeyDown={e => { if (e.key === 'Enter') onManualSearch(); }}
                          onChange={e => setManualInput(e.target.value)}
                          className="px-3 py-2 border rounded w-64"
                        />
                        <button onClick={onManualSearch} className="px-4 py-2 bg-blue-600 text-white rounded">Search</button>
                      </div>
                    </div>
                  )}
                </div>
            </>
          )}

          {/* -------------------- ALLOWED -------------------- */}
          {activeTab === "allowed" && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Devices Currently In School</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allowedDevices.length > 0 ? (
                  allowedDevices.map((d) => (
                    <div key={d.id} className="p-4">
                      <DeviceCard device={d} />
                    </div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                    <p className="text-gray-500">No devices currently in school.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* -------------------- PROFILE -------------------- */}
          {activeTab === "profile" && (
            <div className="max-w-md p-6 bg-white rounded shadow">
              <h2 className="text-xl font-bold mb-4">Profile</h2>

              {securityUser ? (
                <>
                  <p>Email: {securityUser.email}</p>
                  <p>Role: {securityUser.role}</p>
                  <p>Location: {securityUser.locationID}</p>
                  <p className="mt-2"><strong>Shift started:</strong> {securityUser.shiftStartedAt ? (typeof securityUser.shiftStartedAt.toDate === 'function' ? securityUser.shiftStartedAt.toDate().toLocaleString() : new Date(securityUser.shiftStartedAt).toLocaleString()) : '—'}</p>
                  {(!securityUser.name) && (
                    <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400">
                      <p className="text-sm">Please update your full name in your profile — a name helps students and admins identify you.</p>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2 justify-end">
                    <button onClick={() => { setEditingUser(securityUser); setShowEditModal(true); }} className="px-3 py-1 bg-blue-600 text-white rounded">Edit Profile</button>
                  </div>
                </>
              ) : (
                <p>Loading…</p>
              )}
            </div>
          )}
        </div>

        {/* QR Code Generator Modal */}
        {qrGeneratorDevice && (
          <QRCodeGenerator
            device={qrGeneratorDevice}
            onClose={() => setQrGeneratorDevice(null)}
          />
        )}

        {showEditModal && editingUser && (
          <EditSecurityModal
            user={editingUser}
            onClose={() => { setShowEditModal(false); setEditingUser(null); }}
            onSaved={() => { setShowEditModal(false); setEditingUser(null); toast.add('Saved', { type: 'success' }); }}
          />
        )}

        {showFlagModal && flagTarget && (
          <FlagModal
            title="Flag Mismatch"
            placeholder="Reason (optional)"
            defaultValue={flagReason}
            onSubmit={(val) => flagMismatch(flagTarget, val)}
            onClose={() => setShowFlagModal(false)}
          />
        )}
      </div>
    );
}

export default function SecurityHome() {
  return (
    <SecurityHomeContent />
  );
}
