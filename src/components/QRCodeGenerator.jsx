import React, { useRef, useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * QRCodeGenerator.jsx
 * Generates a printable QR code for a device that can be used with the sticker scanner.
 * The QR code contains the device serial number (deviceSN).
 */
export default function QRCodeGenerator({ device, onClose }) {
  const canvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    const generateQR = async () => {
      try {
        if (device.deviceSN) {
          // Generate QR code as data URL
          const dataUrl = await QRCode.toDataURL(device.deviceSN, {
            errorCorrectionLevel: "H",
            type: "image/png",
            quality: 0.95,
            margin: 1,
            width: 300,
            color: {
              dark: "#000000",
              light: "#FFFFFF"
            }
          });
          setQrDataUrl(dataUrl);
        }
        setIsGenerating(false);
      } catch (err) {
        console.error("QR generation failed:", err);
        setIsGenerating(false);
      }
    };

    generateQR();
  }, [device.deviceSN]);

  const handlePrint = () => {
    const printWindow = window.open("", "", "width=600,height=700");
    printWindow.document.write(`
      <html>
        <head>
          <title>Device QR Code - ${device.deviceSN}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              margin: 20px;
              background: white;
            }
            .qr-container {
              text-align: center;
              page-break-after: avoid;
              border: 2px solid #333;
              padding: 20px;
              border-radius: 8px;
            }
            h1 {
              margin-bottom: 10px;
              font-size: 24px;
            }
            .device-info {
              margin-bottom: 20px;
              text-align: center;
            }
            .device-info p {
              margin: 5px 0;
              font-size: 14px;
            }
            .qr-code {
              margin: 20px 0;
              text-align: center;
            }
            img {
              border: 1px solid #ccc;
              padding: 10px;
              background: white;
              max-width: 100%;
            }
            .instructions {
              margin-top: 20px;
              font-size: 12px;
              color: #666;
              max-width: 400px;
            }
            @media print {
              body {
                margin: 0;
              }
              .qr-container {
                border: none;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <h1>Device QR Code Label</h1>
            
            <div class="device-info">
              <p><strong>${device.deviceModel || "Unknown Device"}</strong></p>
              <p>SN: ${device.deviceSN}</p>
              <p>Registration: ${device.registrationNumber || "N/A"}</p>
            </div>

            <div class="qr-code">
              <img src="${qrDataUrl}" alt="QR Code" width="300" height="300" />
            </div>

            <div class="instructions">
              <p><strong>Instructions:</strong></p>
              <p>Print this label and attach it to the device. The sticker scanner will automatically clock in/out when the QR code is scanned.</p>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    if (qrDataUrl) {
      const link = document.createElement("a");
      link.href = qrDataUrl;
      link.download = `qr-code-${device.deviceSN}.png`;
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Generate QR Code</h2>

        <div className="mb-4 p-4 bg-gray-50 rounded">
          <p className="text-sm font-medium mb-2">Device Details:</p>
          <p className="text-sm"><strong>{device.deviceModel}</strong></p>
          <p className="text-xs text-gray-600">SN: {device.deviceSN}</p>
          <p className="text-xs text-gray-600">Reg: {device.registrationNumber || "N/A"}</p>
        </div>

        {isGenerating && (
          <div className="flex justify-center items-center mb-4 h-32">
            <p className="text-gray-500">Generating QR code...</p>
          </div>
        )}

        {!isGenerating && qrDataUrl && (
          <div className="flex justify-center mb-6">
            <img
              src={qrDataUrl}
              alt="QR Code"
              className="border-2 border-gray-300 rounded"
              style={{ width: "200px", height: "200px" }}
            />
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={handlePrint}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300"
          >
            Print Label
          </button>
          <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300"
          >
            Download
          </button>
        </div>

        <div className="p-3 bg-blue-50 rounded mb-4">
          <p className="text-xs text-blue-800">
            <strong>Tip:</strong> Print and attach this QR code to your device. Use the sticker scanner to automatically clock in/out.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Close
        </button>
      </div>
    </div>
  );
}
