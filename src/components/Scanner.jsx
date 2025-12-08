// src/components/Scanner.jsx
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function Scanner({
  onDetected,
  onClose,
  qrbox = 250,
  continuous = false,
  formats = null
}) {
  const containerIdRef = useRef(`scanner-${Math.random().toString(36).slice(2, 9)}`);
  const html5Ref = useRef(null);
  const stoppedRef = useRef(false);

  const [flash, setFlash] = useState(false);
  const [active, setActive] = useState(true);

  // Start Scanner
  useEffect(() => {
    stoppedRef.current = false;

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(containerIdRef.current);
        html5Ref.current = scanner;

        const config = { fps: 10, qrbox };
        if (formats) config.formatsToSupport = formats;

        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            setFlash(true);
            setTimeout(() => setFlash(false), 150);

            if (!continuous) {
              scanner.stop().then(() => scanner.clear()).finally(() => {
                if (!stoppedRef.current) {
                  stoppedRef.current = true;
                  setActive(false);
                  onDetected && onDetected(decodedText);
                }
              });
            } else {
              onDetected && onDetected(decodedText);
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Scanner failed to start:", err);
      }
    };

    const t = setTimeout(startScanner, 80);

    return () => {
      stoppedRef.current = true;
      clearTimeout(t);
      (async () => {
        try {
          if (html5Ref.current) {
            await html5Ref.current.stop();
            await html5Ref.current.clear();
          }
        } catch {}
      })();
    };
  }, []);

  // Ensure video covers full container
  useEffect(() => {
    const fixVideo = () => {
      const wrapper = document.getElementById(containerIdRef.current);
      if (!wrapper) return;

      const video = wrapper.querySelector("video");
      if (video) {
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.position = "absolute";
        video.style.top = "0";
        video.style.left = "0";
      }
    };

    const interval = setInterval(fixVideo, 150);
    return () => clearInterval(interval);
  }, []);

  const handleClose = async () => {
    stoppedRef.current = true;
    try {
      if (html5Ref.current) {
        await html5Ref.current.stop();
        await html5Ref.current.clear();
      }
    } catch {}
    onClose && onClose();
  };

  return (
<div className="relative w-full h-full bg-black flex items-center justify-center">

  {/* Scanner container fills screen height */}
  <div
    id={containerIdRef.current}
    className="w-full h-full relative overflow-hidden rounded-xl"
  />

  {/* Close button */}
  <button
    onClick={handleClose}
    className="absolute top-4 right-4 z-50 px-4 py-1 rounded bg-red-600 text-white shadow"
  >
    Close
  </button>

  {/* Center QR scanning square */}
  <div className="absolute flex items-center justify-center inset-0 pointer-events-none">
    <div
      style={{ width: qrbox, height: qrbox }}
      className={`
        rounded-md border-4 
        ${flash ? "bg-green-300/30 animate-pulse border-green-500" : ""}
        ${active && !flash ? "border-orange-400 animate-pulse" : ""}
      `}
    />
  </div>

  {/* Scanning text */}
  {active && (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-lg opacity-80">
      Scanning…
    </div>
  )}
</div>

  );
}
