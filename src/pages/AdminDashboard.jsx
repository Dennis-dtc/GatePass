// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import TopBar from '../components/TopBar';
import DeviceCard from '../components/DeviceCard';

export default function AdminDashboard() {
  const [devicesInSchool, setDevicesInSchool] = useState([]);
  const [mismatches, setMismatches] = useState([]);
  const [securityUsers, setSecurityUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Devices stream
    const deviceQuery = query(collection(db, 'devices'), orderBy('createdAt', 'desc'));
    const unsubDevices = onSnapshot(deviceQuery, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setDevicesInSchool(all.filter(d => d.status === 'in_school'));
      setMismatches(all.filter(d => d.snMismatch === true));
    }, err => console.error('devices onSnapshot err', err));

    // Security users stream
    const securityQuery = query(collection(db, 'users'), where('role', '==', 'security'));
    const unsubSecurity = onSnapshot(securityQuery, snap => {
      const now = Date.now();
      const users = snap.docs.map(d => {
        const data = d.data();
        // normalize lastActive to milliseconds
        let lastMs = null;
        if (data.lastActive) {
          if (typeof data.lastActive.toMillis === 'function') {
            lastMs = data.lastActive.toMillis();
          } else if (data.lastActive.seconds) {
            lastMs = data.lastActive.seconds * 1000;
          }
        }
        const active = lastMs ? (now - lastMs) < (5 * 60 * 1000) : false;
        return { id: d.id, ...data, active, lastActiveMs: lastMs };
      });
      setSecurityUsers(users);
    }, err => console.error('users onSnapshot err', err));

    return () => {
      unsubDevices();
      unsubSecurity();
    };
  }, []);

  // filter depending on activeTab, searchTerm applies to lists tabs
  const filteredDevices = (activeTab === 'mismatches' ? mismatches : devicesInSchool)
    .filter(d => (d.registrationNumber || '').toLowerCase().includes(searchTerm.toLowerCase()));

  // Top summary - Home tab
  const HomeSummary = () => (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="p-6 bg-white rounded-xl shadow text-center">
        <h3 className="font-bold text-lg">Devices In School</h3>
        <p className="text-2xl">{devicesInSchool.length}</p>
      </div>
      <div className="p-6 bg-white rounded-xl shadow text-center">
        <h3 className="font-bold text-lg">Mismatches</h3>
        <p className="text-2xl">{mismatches.length}</p>
      </div>
      <div className="p-6 bg-white rounded-xl shadow text-center">
        <h3 className="font-bold text-lg">Security Personnel Active</h3>
        <p className="text-2xl">{securityUsers.filter(u => u.active).length}</p>
      </div>
    </div>
  );

  // render content area
  const renderContent = () => {
    if (activeTab === 'home') return <HomeSummary />;

    if (activeTab === 'inSchool' || activeTab === 'mismatches') {
      return (
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredDevices.length > 0
            ? filteredDevices.map(d => <DeviceCard key={d.id} device={d} />)
            : <p className="col-span-full text-center text-gray-500">No devices found.</p>
          }
        </div>
      );
    }

    if (activeTab === 'security') {
      return (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {securityUsers.map(user => (
            <div key={user.id} className="p-4 bg-white rounded-xl shadow flex justify-between items-center">
              <div>
                <p className="font-medium">{user.email || user.name || user.id}</p>
                <p className="text-sm text-gray-500">{user.locationID ? `Loc: ${user.locationID}` : ''}</p>
              </div>
              <span className={`px-2 py-1 rounded text-white text-sm ${user.active ? 'bg-green-500' : 'bg-gray-400'}`}>
                {user.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'profile') {
      return <div className="p-6 col-span-full text-center text-gray-700">Admin profile info goes here.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <TopBar
        title="Admin Dashboard"
        links={[
          { label: 'Home', onClick: () => setActiveTab('home') },
          { label: 'In School', onClick: () => setActiveTab('inSchool') },
          { label: 'Mismatches', onClick: () => setActiveTab('mismatches'), alertCount: mismatches.length },
          { label: 'Security Personnel', onClick: () => setActiveTab('security') },
        ]}
        profileLink={{ label: 'Profile', onClick: () => setActiveTab('profile') }}
      />

      {/* Search bar below topbar (only for listing tabs) */}
      {(activeTab === 'inSchool' || activeTab === 'mismatches') && (
        <div className="flex justify-end px-6 py-3 bg-white shadow-sm">
          <input
            type="text"
            placeholder="Search by Registration Number"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="p-2 border rounded w-full md:w-1/3"
          />
        </div>
      )}

      {renderContent()}
    </div>
  );
}
