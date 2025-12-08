// src/pages/SecurityHome.jsx
import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import TopBar from "../components/TopBar";
import DeviceCard from "../components/DeviceCard";
import Scanner from "../components/Scanner";

export default function SecurityHome() {
  const { auth } = useAuth();
  const securityUID = auth?.uid || null;

  const [activeTab, setActiveTab] = useState("scan"); // 'scan' | 'allowed' | 'profile'
  const [allowedDevices, setAllowedDevices] = useState([]); // in_school
  const [scannedResults, setScannedResults] = useState(null); // array of device objects to act on
  const [scannerMode, setScannerMode] = useState(null); // null | 'qr' | 'sticker'
  const [searchTerm, setSearchTerm] = useState("");
  const [securityUser, setSecurityUser] = useState(null);

  // listen allowed devices (in_school)
  useEffect(() => {
    const q = query(collection(db, "devices"), where("status", "==", "in_school"));
    const unsub = onSnapshot(
      q,
      snap => setAllowedDevices(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error("allowed devices snapshot:", err)
    );
    return () => unsub();
  }, []);

  // Load security user record (profile) in real-time
  useEffect(() => {
    if (!securityUID) return;
    const ref = doc(db, "users", securityUID);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) setSecurityUser({ id: snap.id, ...snap.data() });
    }, err => console.error("security user snapshot err", err));
    return () => unsub();
  }, [securityUID]);

  // Core handler: called by Scanner when a code is detected
  const onScannerDetected = async (text) => {
    // camera is stopped by Scanner (non-continuous mode). We need to parse text and query.
    // text may be JSON { sn: [..], registrationNumber } or plain deviceSN or registrationNumber.
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      parsed = null;
    }

    // determine SN list to search for
    let snList = [];
    let regNumber = null;

    if (parsed) {
      if (Array.isArray(parsed.sn)) {
        snList = parsed.sn;
      } else if (parsed.sn) {
        snList = [parsed.sn];
      }
      regNumber = parsed.registrationNumber || parsed.reg || parsed.registrationNo || null;
    }

    // If no sn provided, treat text as either deviceSN or registrationNumber
    if (snList.length === 0) {
      // try treat text as a single SN
      snList = [text];
    }

    // Firestore 'in' queries accept up to 10 values. If more, fetch all and filter.
    let found = [];
    try {
      if (snList.length <= 10) {
        const q = query(collection(db, "devices"), where("deviceSN", "in", snList));
        const snap = await getDocs(q);
        found = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } else {
        // fallback: fetch all devices and filter locally
        const allSnap = await getDocs(collection(db, "devices"));
        const all = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        found = all.filter(dev => snList.includes(dev.deviceSN));
      }

      // If we didn't find by deviceSN, try by registrationNumber (single)
      if (found.length === 0 && regNumber) {
        const q2 = query(collection(db, "devices"), where("registrationNumber", "==", regNumber));
        const snap2 = await getDocs(q2);
        found = snap2.docs.map(d => ({ id: d.id, ...d.data() }));
      }

    } catch (err) {
      console.error("Error querying scanned devices:", err);
      alert("Scan query failed: " + (err.message || err));
      return;
    }

    if (!found.length) {
      alert("No registered device found for this scan.");
      return;
    }

    // set scanned results (array)
    setScannedResults(found);
    // switch to results area (keeps topbar visible)
    setActiveTab("scan");
    // stop scanner mode so UI shows results
    setScannerMode(null);
  };

  // Sticker (line barcode) continuous scanner handler
  // in sticker mode, Scanner is started with continuous=true and will call this repeatedly
  const onStickerDetected = async (text) => {
    // treat text as deviceSN and auto toggle clock in/out
    try {
      const q = query(collection(db, "devices"), where("deviceSN", "==", text));
      const snap = await getDocs(q);
      if (snap.empty) {
        // not found
        alert("Sticker does not match any registered device.");
        return;
      }
      const d = snap.docs[0];
      const device = { id: d.id, ...d.data() };
      const newStatus = device.status === "in_school" ? "out_school" : "in_school";
      await updateDoc(doc(db, "devices", device.id), {
        status: newStatus,
        lastVerifiedAt: new Date(),
        lastScannedBy: securityUID
      });
      // show brief toast / alert and keep sticker scanner active (continuous)
      alert(`Device ${device.deviceSN} ${newStatus === "in_school" ? "clocked in" : "clocked out"}.`);
      // we do NOT set scannedResults, sticker scanner keeps running
    } catch (err) {
      console.error("Sticker scan error", err);
      alert("Sticker scan failed: " + (err.message || err));
    }
  };

  // action buttons for results
  const verifyDevice = async (deviceId) => {
    try {
      await updateDoc(doc(db, "devices", deviceId), {
        status: "in_school",
        lastVerifiedAt: new Date(),
        lastScannedBy: securityUID
      });
      alert("Device verified & clocked in.");
      // clear results and return to scanner standby
      setScannedResults(null);
      setScannerMode("qr");
    } catch (err) {
      console.error("verify error", err);
      alert("Verify failed: " + (err.message || err));
    }
  };

  const clockOutDevice = async (deviceId) => {
    try {
      await updateDoc(doc(db, "devices", deviceId), {
        status: "out_school",
        lastVerifiedAt: new Date(),
        lastScannedBy: securityUID
      });
      alert("Device clocked out.");
      setScannedResults(null);
      setScannerMode("qr");
    } catch (err) {
      console.error("clockout error", err);
      alert("Clock out failed: " + (err.message || err));
    }
  };

const printStickers = async (devicesToPrint) => {
  // Simple QR generator using a canvas (no external libs)
  const generateQR = async (text) => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const qr = new window.QRious({
        value: text,
        size: 260,
        level: "H"
      });
      resolve(qr.toDataURL("image/png"));
    });
  };

  const printWindow = window.open("", "_blank", "width=600,height=800");
  if (!printWindow) {
    alert("Unable to open print window.");
    return;
  }

  let html = `
    <html><head><title>Print Stickers</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      .sticker {
        border: 1px solid #000;
        padding: 16px;
        margin-bottom: 24px;
        text-align: center;
        width: 260px;
      }
      .qr {
        width: 240px;
        height: 240px;
        margin: 0 auto 10px auto;
      }
      .sn-label {
        font-size: 18px;
        font-weight: bold;
        margin-top: 8px;
      }
    </style>
    </head><body>
  `;

  // Generate QR codes one by one
  for (const d of devicesToPrint) {
    const qrDataUrl = await generateQR(d.deviceSN);
    html += `
      <div class="sticker">
        <img class="qr" src="${qrDataUrl}" />
        <div class="sn-label">${d.deviceSN}</div>
      </div>
    `;
  }

  html += `<script>setTimeout(() => window.print(), 500)</script></body></html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};


  // UI helpers
  const openQrScanner = () => {
    setScannedResults(null);
    setScannerMode("qr");
  };
  const openStickerScanner = () => {
    setScannedResults(null);
    setScannerMode("sticker");
  };
  const closeAnyScanner = () => {
    setScannerMode(null);
    // keep scannedResults as-is (if present)
  };

  // filtered allowed devices by registrationNumber search (admin asked search below topbar)
  const filteredAllowed = allowedDevices.filter(d => (d.registrationNumber||"").toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar
        title="Security Home"
        links={[
          { label: "Scan Device", onClick: () => { setActiveTab("scan"); openQrScanner(); } },
          { label: "Allowed Devices", onClick: () => { setActiveTab("allowed"); setScannerMode(null); } },
          { label: "Profile", onClick: () => { setActiveTab("profile"); setScannerMode(null); } }
        ]}
      />

      {/* Search under topbar for allowed tab */}
      {activeTab === "allowed" && (
        <div className="p-4 flex justify-end bg-white shadow-sm">
          <input
            type="text"
            placeholder="Search by Registration Number"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="p-2 border rounded w-64"
          />
        </div>
      )}

      <div className="p-6 max-w-6xl mx-auto">
        {/* SCAN tab */}
        {activeTab === "scan" && (
          <>
            {/* controls row */}
            <div className="flex items-center gap-4 mb-4">
              <button onClick={openQrScanner} className="px-4 py-2 bg-blue-600 text-white rounded">Open Camera Scanner</button>
              <button onClick={openStickerScanner} className="px-4 py-2 bg-gray-800 text-white rounded">Open Sticker Scanner</button>
              <div className="text-sm text-gray-600">Scan student QR to view registered device(s). Sticker scanner reads printed sticker barcodes (continuous).</div>
            </div>

            {/* scanner area */}
            <div className="bg-gray-200 rounded-lg overflow-hidden">
              {scannerMode === "qr" && (
                <div className="w-full h-96">
                  <Scanner
                    onDetected={async (text) => {
                      // Scanner in non-continuous mode will stop after detection
                      await onScannerDetected(text);
                    }}
                    onClose={closeAnyScanner}
                    qrbox={280}
                    continuous={false}
                  />
                </div>
              )}

              {scannerMode === "sticker" && (
                <div className="w-full h-96">
                  <Scanner
                    onDetected={async (text) => {
                      // continuous mode: keep scanner alive
                      await onStickerDetected(text);
                    }}
                    onClose={closeAnyScanner}
                    qrbox={320}
                    continuous={true}
                  />
                </div>
              )}

              {!scannerMode && !scannedResults && (
                <div className="p-10 text-center text-gray-600">
                  Camera is inactive. Click "Open Camera Scanner" or "Open Sticker Scanner" to begin.
                </div>
              )}
            </div>

            {/* scanned results area (cards + actions) */}
            {scannedResults && (
              <div className="mt-6">
                <h3 className="text-xl font-semibold mb-3">Scanned Result</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scannedResults.map(d => (
                    <div key={d.id} className="p-4 bg-white rounded-xl shadow">
                      <DeviceCard device={d} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => verifyDevice(d.id)} className="px-3 py-1 bg-green-600 text-white rounded">Verify / Clock In</button>
                        <button onClick={() => clockOutDevice(d.id)} className="px-3 py-1 bg-red-600 text-white rounded">Clock Out</button>
                        <button onClick={() => printStickers([d])} className="px-3 py-1 bg-gray-800 text-white rounded">Print Sticker</button>
                        <button onClick={() => { setScannedResults(null); setScannerMode("qr"); }} className="px-3 py-1 bg-blue-200 rounded">Scan Next</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ALLOWED tab */}
        {activeTab === "allowed" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredAllowed.length > 0 ? (
              filteredAllowed.map(d => <DeviceCard key={d.id} device={d} />)
            ) : (
              <p className="text-center text-gray-500 col-span-full">No devices currently in school.</p>
            )}
          </div>
        )}

        {/* PROFILE tab */}
        {activeTab === "profile" && (
          <div className="max-w-md p-6 bg-white rounded-xl shadow">
            <h2 className="text-xl font-bold mb-4">Profile</h2>
            {securityUser ? (
              <div className="space-y-2">
                <p>Email: {securityUser.email}</p>
                <p>Role: {securityUser.role}</p>
                <p>Location: {securityUser.locationID || "--"}</p>
                <p>Last active: {securityUser.lastActive ? new Date(securityUser.lastActive.seconds * 1000).toLocaleString() : "Never"}</p>
              </div>
            ) : (
              <p>Loading profile...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
