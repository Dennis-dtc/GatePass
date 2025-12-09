// src/components/Scanner.jsx
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
Html5Qrcode.workerPath = import.meta.env.BASE_URL + "html5-qrcode-worker.min.js";


export default function Scanner({
  onDetected,
  onClose,
  qrbox = 250,
  continuous = false,
  formats = null
}) {
  const containerId = useRef("scan-" + Math.random().toString(36).slice(2));
  const scannerRef = useRef(null);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stopped = false;

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(containerId.current);
        scannerRef.current = scanner;

        const config = {
          fps: 12,
          qrbox,
        };
        if (formats) config.formatsToSupport = formats;

        await scanner.start(
          { facingMode: "environment" },
          config,
          (text) => {
            setFlash(true);
            setTimeout(() => setFlash(false), 120);

            if (!continuous) {
              // non-continuous → stop after one scan
              scanner.stop().then(() => scanner.clear());
              if (!stopped) onDetected(text);
            } else {
              // continuous → keep camera running
              onDetected(text);
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("SCAN ERROR:", err);
      }
    };

    start();

    return () => {
      stopped = true;
      (async () => {
        try {
          if (scannerRef.current) {
            await scannerRef.current.stop();
            await scannerRef.current.clear();
          }
        } catch {}
      })();
    };
  }, []);

  return (
    <div className="relative w-full h-full bg-green">
      {/* Camera container */}
      <div
        id={containerId.current}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: "cover" }}
      />

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-50 bg-red-600 text-white px-3 py-1 rounded"
      >
        Close
      </button>

      {/* Center scan box */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="border-4 border-white/60 rounded-md"
          style={{ width: qrbox, height: qrbox }}
        />
      </div>

      {/* Flash effect */}
      {flash && (
        <div className="absolute inset-0 bg-green-300 opacity-20 animate-pulse pointer-events-none"></div>
      )}
    </div>
  );
}
