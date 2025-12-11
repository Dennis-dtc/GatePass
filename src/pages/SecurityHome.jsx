// src/pages/SecurityHome.jsx
import React, { useEffect, useState, createContext, useContext } from "react";
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import TopBar from "../components/TopBar";
import DeviceCard from "../components/DeviceCard";
import Scanner from "../components/Scanner";
import QRCodeGenerator from "../components/QRCodeGenerator";

/* -------------------- Toast System -------------------- */
const ToastContext = createContext();
function useToast() {
  return useContext(ToastContext);
}
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = (message, opts = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    const toast = {
      id,
      message,
      type: opts.type || "info",
      timeout: opts.timeout ?? 4000
    };

    setToasts((s) => [toast, ...s]);

    if (toast.timeout > 0) {
      setTimeout(() => {
        setToasts((s) => s.filter((t) => t.id !== id));
      }, toast.timeout);
    }
  };

  const remove = (id) => setToasts((s) => s.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ add, remove }}>
      {children}

      <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`max-w-sm px-4 py-2 rounded shadow-md text-white ${
              t.type === "success"
                ? "bg-green-600"
                : t.type === "error"
                ? "bg-red-600"
                : "bg-gray-800"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">{t.message}</div>
              <button onClick={() => remove(t.id)} className="text-xs opacity-70">✕</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* -------------------- Main Component -------------------- */
function SecurityHomeContent() {
  const { auth } = useAuth();
  const securityUID = auth?.uid || null;

  const toast = useToast();

  const [activeTab, setActiveTab] = useState("scan");
  const [scannerMode, setScannerMode] = useState(null);       // null | "qr" | "sticker"
  const [scannedResults, setScannedResults] = useState(null); // array of found devices
  const [allowedDevices, setAllowedDevices] = useState([]);
  const [securityUser, setSecurityUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [qrGeneratorDevice, setQrGeneratorDevice] = useState(null); // device for QR generation modal

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

      toast.add(`Device ${text} ${newStatus}.`, { type: "success" });
    } catch {
      toast.add("Sticker scan failed.", { type: "error" });
    }
  };

  /* -------------------- Action buttons -------------------- */
  const verifyDevice = async (id) => {
    try {
      await updateDoc(doc(db, "devices", id), {
        status: "in_school",
        lastVerifiedAt: serverTimestamp(),
        lastScannedBy: securityUID
      });
      toast.add("Clocked in.", { type: "success" });
    } catch (err) {
      console.error("Clock in failed:", err);
      toast.add("Clock in failed.", { type: "error" });
    }
  };

  const clockOutDevice = async (id) => {
    try {
      await updateDoc(doc(db, "devices", id), {
        status: "out_school",
        lastVerifiedAt: serverTimestamp(),
        lastScannedBy: securityUID
      });
      toast.add("Clocked out.", { type: "success" });
    } catch (err) {
      console.error("Clock out failed:", err);
      toast.add("Clock out failed.", { type: "error" });
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
                    Click a open camera scanner button to begin.
                  </div>
                )}
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* -------------------- ALLOWED -------------------- */}
          {activeTab === "allowed" && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Devices Currently In School</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allowedDevices.length > 0 ? (
                  allowedDevices.map((d) => (
                    <div key={d.id} className="p-4 bg-white rounded shadow">
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
      </div>
    );
}

export default function SecurityHome() {
  return (
    <ToastProvider>
      <SecurityHomeContent />
    </ToastProvider>
  );
}
