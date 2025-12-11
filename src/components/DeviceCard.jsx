import React from "react";

export default function DeviceCard({ device }) {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Never";
    // Handle Firestore Timestamp objects
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <div className="p-4 bg-white rounded-xl shadow text-center hover:shadow-lg transition duration-200">
      <p className="text-lg font-semibold mb-1">
        {device.deviceModel || "Unknown Device"}
      </p>

      <p className="text-sm mb-1">
        SN: {device.deviceSN || "Unknown"}
      </p>

      <p className="text-sm mb-1">
        Registration No: {device.registrationNumber || "Unknown"}
      </p>

      <p
        className={`text-sm font-medium mb-2 ${
          device.status === "in_school"
            ? "text-green-600"
            : "text-gray-700"
        }`}
      >
        Status: {device.status === "in_school" ? "In School" : "Out of School"}
      </p>

      <p className="text-xs text-gray-500 mb-1">
        Last Verified: {formatTimestamp(device.lastVerifiedAt)}
      </p>

      {device.lastScannedBy && (
        <p className="text-xs text-gray-400">
          By: {device.lastScannedBy}
        </p>
      )}
    </div>
  );
}
