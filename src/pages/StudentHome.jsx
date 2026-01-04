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
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import TopBar from '../components/TopBar';
import AddDeviceModal from '../components/AddDeviceModal';
import DeviceCard from '../components/DeviceCard';
import QRCodeDisplay from '../components/QRCodeDisplay';
import EditProfileModal from '../components/EditProfileModal';
import { ConfirmModal } from '../components/Modals';

export default function StudentHome() {
  const { auth, logout } = useAuth();
  const toast = useToast();
  const studentUID = auth?.uid;
  const [loadingUser, setLoadingUser] = useState(true);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [studentName, setStudentName] = useState('');
  const [devices, setDevices] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrValue, setQrValue] = useState(null);
  const [activeTab, setActiveTab] = useState('devices');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });

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
            setStudentName(data.name || '');
          setUserProfile({ id: snap.id, ...data });
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

  const openEditProfile = () => {
    setShowEditProfile(true);
  };

  // Add device with hidden registrationNumber injection
  const handleAddDevice = async ({ deviceModel, deviceSN }) => {
    if (!studentUID) {
      toast.add('Not authenticated. Please login again.', { type: 'error' });
      return;
    }

    if (!registrationNumber) {
      toast.add('Your registration number is missing. Contact admin.', { type: 'error' });
      return;
    }

    try {
      await addDoc(collection(db, 'devices'), {
        ownerUID: studentUID,
        registrationNumber: registrationNumber.trim(),
        ownerName: studentName || null,
        deviceModel: deviceModel || 'Unknown',
        deviceSN: deviceSN || 'Unknown',
        status: 'out_school',
        createdAt: new Date()
      });

      setShowAdd(false);
    } catch (err) {
      toast.add('Error registering device: ' + err.message, { type: 'error' });
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

  // compute last clock in time (most recent lastVerifiedAt when status=in_school)
  const [lastClockIn, setLastClockIn] = useState(null);
  useEffect(() => {
    if (!devices || devices.length === 0) { setLastClockIn(null); return; }
    let latest = null;
    devices.forEach(d => {
      if (d.status === 'in_school' && d.lastVerifiedAt) {
        const date = d.lastVerifiedAt.toDate ? d.lastVerifiedAt.toDate() : new Date(d.lastVerifiedAt);
        if (!latest || date > latest) latest = date;
      }
    });
    setLastClockIn(latest);
  }, [devices]);

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
          { label: 'Devices', onClick: () => setActiveTab('devices') },
          { label: 'Add Device', onClick: () => setShowAdd(true) },
          { label: 'My QR Code', onClick: handleShowQR },
          { label: 'Profile', onClick: () => setActiveTab('profile') }
        ]}
        onLogout={logout}
      />

      <div className="p-6 max-w-6xl mx-auto">
        {activeTab === 'devices' && (
          <>
            <div className="flex items-baseline justify-between">
              <div>
                <h1 className="text-2xl font-bold">Your Devices</h1>
                <p className="text-sm text-gray-600">Registration No: {loadingUser ? 'Loading...' : (registrationNumber || 'Not set')}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Last clocked in</p>
                <p className="text-sm font-medium">{lastClockIn ? lastClockIn.toLocaleString() : '—'}</p>
              </div>
            </div>

            {devices.length === 0 ? (
              <div className="p-8 bg-white rounded shadow text-center mt-6">
                No devices registered yet. Click Add Device to register.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {devices.map(d => (
                  <div key={d.id} className="p-4 bg-white rounded-xl shadow hover:shadow-lg transition duration-200">
                    <DeviceCard device={d} />
                    <div className="mt-3 flex gap-2 justify-between">
                      <button onClick={() => setConfirmState({ open: true, title: 'Delete Device', message: `Please confirm you want to permanently delete this device (SN: ${d.deviceSN}). This action cannot be undone.`, onConfirm: async () => {
                        try {
                          await deleteDoc(doc(db, 'devices', d.id));
                          toast.add('Device deleted', { type: 'success' });
                        } catch (e) {
                          console.error('delete device error', e);
                          toast.add('Failed to delete device: ' + e.message, { type: 'error' });
                        } finally {
                          setConfirmState({ open: false, message: '', onConfirm: null });
                        }
                      } })} className="px-3 py-1 bg-red-600 text-white rounded">Delete Device</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-md p-6 bg-white rounded shadow">
            <h2 className="text-xl font-bold mb-2">Profile</h2>
            <p className="mb-1"><strong>Name:</strong> {userProfile?.name || '—'}</p>
            <p className="mb-1"><strong>Email:</strong> {userProfile?.email || auth?.email || '—'}</p>
            <p className="mb-1"><strong>Registration No:</strong> {userProfile?.registrationNumber || '—'}</p>
            <p className="mb-1"><strong>Phone:</strong> {userProfile?.phone || '—'}</p>
            {(!userProfile?.name || !userProfile?.phone) && (
              <div className="mt-3 p-3 bg-yellow-50 border-l-4 border-yellow-400">
                <p className="text-sm">We recommend updating your Name and Phone to help security verify device owners quickly.</p>
              </div>
            )}
            <div className="mt-3 flex gap-2 justify-end">
              <button onClick={() => openEditProfile()} className="px-3 py-1 bg-blue-600 text-white rounded">Edit Profile</button>
            </div>
          </div>
        )}
      </div>

      {showAdd && (
        <AddDeviceModal
          onSubmit={handleAddDevice}
          onClose={() => setShowAdd(false)}
        />
      )}
      {showEditProfile && userProfile && (
        <EditProfileModal
          user={userProfile}
          onClose={() => setShowEditProfile(false)}
          onSaved={async () => {
            try {
              const ref = doc(db, 'users', studentUID);
              const snap = await getDoc(ref);
              if (snap.exists()) setUserProfile({ id: snap.id, ...snap.data() });
            } catch (e) { console.error(e); }
          }}
        />
      )}

      {showQR && qrValue && (
        <QRCodeDisplay
          value={JSON.stringify(qrValue)}
          onClose={() => setShowQR(false)}
        />
      )}
      {confirmState.open && (
        <ConfirmModal title={confirmState.title} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState({ open: false, message: '', onConfirm: null })} />
      )}
    </div>
  );
}
