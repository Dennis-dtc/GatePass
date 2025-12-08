import React from "react";

export default function DeviceCard({ device }) {
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
        className={`text-sm font-medium ${
          device.status === "in_school"
            ? "text-green-600"
            : "text-gray-700"
        }`}
      >
        Status: {device.status === "in_school" ? "In School" : "Out of School"}
      </p>
    </div>
  );
}
