// src/components/Scanner.jsx
import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * Scanner.jsx
 * - Props:
 *    onDetected(text: string) => void
 *    onClose() => void
 *    qrbox = number (px)
 *    continuous = boolean
 *
 * Notes:
 * - Uses native BarcodeDetector when available.
 * - Includes animated scan line, success/fail flashes, scanning label, and beep (WebAudio).
 * - For browsers without BarcodeDetector you should wire in jsQR in the fallback (commented).
 */

export default function Scanner({ onDetected, onClose, qrbox = 280, continuous = false }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const pollingRef = useRef(null);
  const lastDetectedRef = useRef({ text: null, time: 0 });

  const [facingMode, setFacingMode] = useState("environment");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [supportedFormats, setSupportedFormats] = useState([]);
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);
  const [showFailFlash, setShowFailFlash] = useState(false);
  const [showPulse, setShowPulse] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const constraints = {
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }

        if ("BarcodeDetector" in window) {
          try {
            const formats = await window.BarcodeDetector.getSupportedFormats();
            setSupportedFormats(formats || []);
          } catch (e) {
            setSupportedFormats([]);
          }
        } else {
          setSupportedFormats([]);
        }

        startPolling();
      } catch (err) {
        console.error("Camera start failed", err);
        setPermissionDenied(true);
      }
    }

    startCamera();

    return () => {
      mounted = false;
      stopCamera();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  // Debounce helper: ignore same text within 1500ms
  const shouldProcess = (text) => {
    const now = Date.now();
    if (!text) return false;
    if (lastDetectedRef.current.text === text && now - lastDetectedRef.current.time < 1500) {
      return false;
    }
    lastDetectedRef.current = { text, time: now };
    return true;
  };

  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      if (isDetecting) return;
      setIsDetecting(true);

      try {
        // Primary path: BarcodeDetector + qr_code
        if ("BarcodeDetector" in window && supportedFormats.includes("qr_code")) {
          const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const value = barcodes[0].rawValue;
            handleDetection(value);
          }
        } else {
          // Fallback: draw to canvas, then decode with jsQR
          const canvas = canvasRef.current;
          if (canvas && video) {
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
              handleDetection(code.data);
            }
          }
        }
      } catch (err) {
        console.error("Scanning error:", err);
      } finally {
        setIsDetecting(false);
      }
    }, 350); // scanning ~3x/sec to feel responsive
  };

  // Play a short beep using Web Audio API
  const playBeep = (opts = { duration: 0.08, frequency: 1000, volume: 0.05 }) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = opts.frequency;
      g.gain.value = opts.volume;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        ctx.close().catch(() => {});
      }, opts.duration * 1000);
    } catch (e) {
      // ignore audio errors (some browsers restrict auto-play)
    }
  };

  const handleDetection = async (text) => {
    if (!text) {
      flashFail();
      return;
    }
    if (!shouldProcess(text)) return;

    // show success animation
    flashSuccess();

    // beep
    playBeep();

    try {
      // If not continuous, stop camera after a short delay to let animations play
      if (!continuous) {
        // allow 550ms for animation to show
        setTimeout(() => {
          stopCamera();
        }, 520);
      }
      // call parent handler
      onDetected && onDetected(text);
    } catch (err) {
      console.error("onDetected handler error:", err);
      flashFail();
    }
  };

  const flashSuccess = () => {
    setShowSuccessFlash(true);
    setShowPulse(false);
    setTimeout(() => {
      setShowSuccessFlash(false);
      // re-enable pulse after small delay for continuous scanner
      if (continuous) setTimeout(() => setShowPulse(true), 350);
    }, 520);
  };

  const flashFail = () => {
    setShowFailFlash(true);
    setShowPulse(false);
    setTimeout(() => {
      setShowFailFlash(false);
      if (continuous) setTimeout(() => setShowPulse(true), 350);
    }, 520);
  };

  const handleClose = () => {
    stopCamera();
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    onClose && onClose();
  };

  const toggleFacing = () => {
    setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
    // restart handled by effect; ensure camera tracks stopped to let new one start clean
    stopCamera();
  };

  return (
    <div className="relative w-full h-full bg-black rounded overflow-hidden">
      {/* video */}
      <video
        ref={videoRef}
        className={`w-full h-full object-cover transition-opacity duration-300 ${showSuccessFlash ? "opacity-50" : "opacity-100"}`}
        playsInline
        muted
      />

      {/* dark vignette + scanning box */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* vignette achieved via box-shadow technique on an inner element */}
        <div
          style={{
            width: qrbox,
            height: qrbox,
            borderRadius: 12,
            border: "2px dashed rgba(255,255,255,0.85)",
            position: "relative",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.48)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}
        >
          <div className="text-white text-sm opacity-95 z-10">{showPulse ? "Scanning…" : "Processing..."}</div>
        </div>
      </div>

      {/* controls */}
      <div className="absolute left-2 top-2 flex gap-2 z-20">
        <button
          onClick={toggleFacing}
          type="button"
          className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded backdrop-blur"
        >
          Flip
        </button>
        <button
          onClick={handleClose}
          type="button"
          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
        >
          Close
        </button>
      </div>

      {/* status pill */}
      <div className="absolute right-2 top-2 text-xs text-white/90 bg-black/40 px-2 py-1 rounded z-20">
        {continuous ? "Sticker (continuous)" : "QR (single)"}
      </div>

      {/* hidden canvas for fallback */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* permission denied overlay */}
      {permissionDenied && (
        <div className="absolute inset-0 flex items-center justify-center z-30">
          <div className="bg-white/95 p-4 rounded shadow text-center max-w-xs">
            <p className="font-semibold">Camera permission required</p>
            <p className="text-sm mt-1">Please allow camera access in your browser to scan codes.</p>
            <div className="mt-3">
              <button
                onClick={() => {
                  setPermissionDenied(false);
                  setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                Try again
              </button>
              <button onClick={handleClose} className="ml-2 px-3 py-1 bg-gray-200 rounded">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* small stylesheet for scan-line animation */}
      <style>{`
        @keyframes scan-move {
          0% { transform: translateY(-10%); opacity: 0.0; }
          10% { opacity: 0.6; }
          50% { transform: translateY(105%); opacity: 1; }
          90% { opacity: 0.6; }
          100% { transform: translateY(110%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
