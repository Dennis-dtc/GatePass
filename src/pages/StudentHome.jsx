// src/pages/StudentHome.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import AddDeviceModal from '../components/AddDeviceModal';
import DeviceCard from '../components/DeviceCard';
import QRCodeDisplay from '../components/QRCodeDisplay';

export default function StudentHome() {
  const { auth } = useAuth();
  const studentUID = auth?.uid;

  const [loadingUser, setLoadingUser] = useState(true);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [devices, setDevices] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQrValue] = useState(null);

  // Load student's registration number
  useEffect(() => {
    if (!studentUID) {
      setLoadingUser(false);
      return;
    }

    const loadUser = async () => {
      try {
        const ref = doc(db, 'users', studentUID);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data();
          setRegistrationNumber(data.registrationNumber || '');
        } else {
          setRegistrationNumber('');
        }
      } catch (err) {
        console.error('Failed to load user:', err);
      } finally {
        setLoadingUser(false);
      }
    };

    loadUser();
  }, [studentUID]);

  // Listen for student devices
  useEffect(() => {
    if (!studentUID) {
      setDevices([]);
      return;
    }

    const q = query(collection(db, 'devices'), where('ownerUID', '==', studentUID));
    const unsub = onSnapshot(q, snap => {
      setDevices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [studentUID]);

  // Add device with hidden registrationNumber injection
  const handleAddDevice = async ({ deviceModel, deviceSN }) => {
    if (!studentUID) {
      alert('Not authenticated. Please login again.');
      return;
    }

    if (!registrationNumber) {
      alert('Your registration number is missing. Contact admin.');
      return;
    }

    try {
      await addDoc(collection(db, 'devices'), {
        ownerUID: studentUID,
        registrationNumber: registrationNumber.trim(),
        deviceModel: deviceModel || 'Unknown',
        deviceSN: deviceSN || 'Unknown',
        status: 'out_school',
        createdAt: new Date()
      });

      setShowAdd(false);
    } catch (err) {
      alert('Error registering device: ' + err.message);
    }
  };

  const handleShowQR = () => {
    const snList = devices.map(d => d.deviceSN);

    setQrValue({
      registrationNumber,
      sn: snList
    });

    setShowQR(true);
  };

  if (!studentUID) {
    return (
      <div className="p-8 text-center text-red-600">
        You are not logged in. Please login again.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar
        title="Student Home"
        links={[
          { label: 'Add Device', onClick: () => setShowAdd(true) },
          { label: 'My QR Code', onClick: handleShowQR }
        ]}
      />

      <div className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">Your Devices</h1>

        <p className="text-sm text-gray-600">
          Registration No: {loadingUser ? 'Loading...' : (registrationNumber || 'Not set')}
        </p>

        {devices.length === 0 ? (
          <div className="p-8 bg-white rounded shadow text-center mt-6">
            No devices registered yet. Click Add Device to register.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {devices.map(d => <DeviceCard key={d.id} device={d} />)}
          </div>
        )}
      </div>

      {showAdd && (
        <AddDeviceModal
          onSubmit={handleAddDevice}
          onClose={() => setShowAdd(false)}
        />
      )}

      {showQR && qrValue && (
        <QRCodeDisplay
          value={JSON.stringify(qrValue)}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
}
