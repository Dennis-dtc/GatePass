
// src/pages/AdminDashboard.jsx
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, where, addDoc, doc, deleteDoc, updateDoc, getDoc, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import TopBar from '../components/TopBar';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import DeviceCard from '../components/DeviceCard';
import AddSecurityModal from '../components/AddSecurityModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import EditSecurityModal from '../components/EditSecurityModal';
import { ConfirmModal, UserProfileModal } from '../components/Modals';

export default function AdminDashboard() {
  const [devicesInSchool, setDevicesInSchool] = useState([]);
  const [mismatches, setMismatches] = useState([]);
  const [securityUsers, setSecurityUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [searchTerm, setSearchTerm] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [securityInvites, setSecurityInvites] = useState([]);
  const { auth, logout } = useAuth();
  const toast = useToast();
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });
  const [adminProfile, setAdminProfile] = useState(null);
  const [invitesCount, setInvitesCount] = useState(0);
  const [devicesCount, setDevicesCount] = useState(0);
  const [ownerModal, setOwnerModal] = useState({ open: false, owner: null, device: null, serialOwner: null });
  const [mismatchCounts, setMismatchCounts] = useState(new Array(7).fill(0));
  const [clockinCounts, setClockinCounts] = useState(new Array(7).fill(0));
  const navigate = useNavigate();

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

    // Load invites (separate stream)
    const invitesQuery = query(collection(db, 'securityInvites'), orderBy('invitedAt', 'desc'));
    const unsubInvites = onSnapshot(invitesQuery, snap => {
      setSecurityInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    

    return () => {
      unsubDevices();
      unsubSecurity();
      try { unsubInvites(); } catch (e) {}
    };
  }, []);

  // Load admin profile + counts
  useEffect(() => {
    if (!auth?.uid) return;
    const loadProfile = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', auth.uid));
        if (snap.exists()) setAdminProfile(snap.data());
      } catch (e) { console.error(e); }

      try {
        const q = query(collection(db, 'securityInvites'), where('invitedBy', '==', auth.uid));
        const snap = await getDocs(q);
        setInvitesCount(snap.size);
      } catch (e) { console.error(e); }

      try {
        const q2 = query(collection(db, 'devices'), orderBy('createdAt', 'desc'));
        const snap2 = await getDocs(q2);
        setDevicesCount(snap2.size);
      } catch (e) { console.error(e); }
    };

    loadProfile();
  }, [auth?.uid]);

  // Weekly aggregates for last logs (by weekday: 0-Sun .. 6-Sat)
  useEffect(() => {
    let cancelled = false;
    const buildWeek = async () => {
      try {
            // Clock-in counts from logs
        const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(1000));
        const snapLogs = await getDocs(qLogs);
        const clk = new Array(7).fill(0);
        snapLogs.docs.forEach(d => {
          const data = d.data();
          const ts = data.timestamp;
          if (!ts) return;
          const date = ts.toDate ? ts.toDate() : new Date(ts);
          const wd = date.getDay();
          if (data.action === 'in') clk[wd] += 1;
        });

        // Mismatch counts from flags collection (use flaggedAt)
        // Deduplicate flags by (deviceID + flaggedSN) to match AdminReports' table view
        const qFlags = query(collection(db, 'flags'), orderBy('flaggedAt', 'desc'), limit(1000));
        const snapFlags = await getDocs(qFlags);
        const fetchedFlags = snapFlags.docs.map(d => ({ id: d.id, ...d.data() }));
        const groups = {};
        fetchedFlags.forEach(f => {
          const key = `${f.deviceID || ''}::${f.flaggedSN || ''}`;
          groups[key] = groups[key] || [];
          groups[key].push(f);
        });
        const keepers = Object.values(groups).map(list => {
          const opens = list.filter(x => x.status === 'open');
          const candidates = opens.length ? opens : list;
          const keeper = candidates.reduce((a,b) => {
            const ta = a.flaggedAt && a.flaggedAt.toDate ? a.flaggedAt.toDate().getTime() : (a.flaggedAt ? new Date(a.flaggedAt).getTime() : 0);
            const tb = b.flaggedAt && b.flaggedAt.toDate ? b.flaggedAt.toDate().getTime() : (b.flaggedAt ? new Date(b.flaggedAt).getTime() : 0);
            return tb > ta ? b : a;
          });
          return keeper;
        });
        const mism = new Array(7).fill(0);
        keepers.forEach(data => {
          const ts = data.flaggedAt;
          if (!ts) return;
          const date = ts.toDate ? ts.toDate() : new Date(ts);
          const wd = date.getDay();
          mism[wd] += 1;
        });

        if (!cancelled) {
          setMismatchCounts(mism);
          setClockinCounts(clk);
        }
      } catch (e) {
        console.error('Failed to build weekly aggregates', e);
      }
    };
    buildWeek();
    const id = setInterval(buildWeek, 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // filter depending on activeTab, searchTerm applies to lists tabs
  const filteredDevices = (activeTab === 'mismatches' ? mismatches : devicesInSchool)
    .filter(d => (d.registrationNumber || '').toLowerCase().includes(searchTerm.toLowerCase()));

  const resolveMismatch = async (deviceId) => {
    try {
      await updateDoc(doc(db, 'devices', deviceId), {
        snMismatch: false,
        flagged: false,
        flagResolvedBy: auth?.uid || null,
        flagResolvedAt: new Date(),
      });
      // mark any open flags for this device as resolved
      try {
        const q = query(collection(db, 'flags'), where('deviceID', '==', deviceId), where('status', '==', 'open'));
        const snap = await getDocs(q);
        const updates = snap.docs.map(f => updateDoc(doc(db, 'flags', f.id), { status: 'resolved', resolvedAt: serverTimestamp(), resolvedBy: auth?.uid || null }));
        await Promise.all(updates);
      } catch (e) { console.error('Failed to update flag records on resolve', e); }
      toast.add('Mismatch resolved', { type: 'success' });
    } catch (e) {
      console.error('resolve mismatch error', e);
      toast.add('Failed to resolve mismatch', { type: 'error' });
    }
  };

  const fetchOwner = async (ownerUID) => {
    if (!ownerUID) return null;
    try {
      const snap = await getDoc(doc(db, 'users', ownerUID));
      if (!snap.exists()) return null;
      return snap.data();
    } catch (e) { return null; }
  };

  const openOwnerModal = async (device) => {
    if (!device?.ownerUID) return;
    try {
      const ownerSnap = await getDoc(doc(db, 'users', device.ownerUID));
      const owner = ownerSnap.exists() ? { id: ownerSnap.id, ...ownerSnap.data() } : null;
      setOwnerModal({ open: true, owner, device, serialOwner: null });
    } catch (e) {
      console.error(e);
      toast.add('Failed to load owner', { type: 'error' });
    }
  };

  const checkSerialOwner = async (serial, device) => {
    if (!serial) return null;
    try {
      const q = query(collection(db, 'devices'), where('deviceSN', '==', serial));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.add('Serial not registered with any student.', { type: 'info' });
        setOwnerModal(prev => ({ ...prev, serialOwner: null }));
        return null;
      }
      const found = { id: snap.docs[0].id, ...snap.docs[0].data() };
      const ownerSnap = await getDoc(doc(db, 'users', found.ownerUID));
      const ownerProfile = ownerSnap.exists() ? { id: ownerSnap.id, ...ownerSnap.data() } : null;
      setOwnerModal(prev => ({ ...prev, serialOwner: ownerProfile }));
      return ownerProfile;
    } catch (e) {
      console.error(e);
      toast.add('Failed to check serial owner', { type: 'error' });
      return null;
    }
  };

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

  const WeekBarChart = ({ data = [], color = '#3182ce', title }) => {
    const labels = ['S','M','T','W','Th','F','S'];
    const chartData = data.map((v,i) => ({ name: labels[i], value: v }));
    return (
      <div className="bg-white p-4 rounded shadow">
        <h4 className="font-semibold mb-2">{title}</h4>
        <div style={{ width: '100%', height: 200, minHeight: 200, minWidth: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill={color} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // render content area
  const renderContent = () => {
    if (activeTab === 'home') return (
    <>
      <HomeSummary />
      <div className="p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <WeekBarChart data={mismatchCounts} color="#e53e3e" title="Mismatches by Day (recent)" />
        <WeekBarChart data={clockinCounts} color="#38a169" title="Clock-ins by Day (recent)" />
      </div>
    </>
  );

    if (activeTab === 'inSchool' || activeTab === 'mismatches') {
      return (
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredDevices.length > 0
            ? filteredDevices.map(d => (
                <div key={d.id} className="p-4 bg-white rounded-xl shadow">
                  <DeviceCard device={d} />
                  <div className="mt-2 text-left text-sm text-gray-600">
                    <p>Owner: {d.ownerUID || '—'}</p>
                    <p>Registration: {d.registrationNumber}</p>
                    {d.flagged && <p className="text-red-600">Flagged: {d.flagReason || '—'}</p>}
                    {d.flagged && d.flaggedSN && <p className="text-sm text-gray-700">Serial on device: {d.flaggedSN}</p>}
                  </div>
                  {activeTab === 'mismatches' && (
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button onClick={() => resolveMismatch(d.id)} className="px-3 py-1 bg-green-600 text-white rounded">Resolve</button>
                        <button onClick={() => openOwnerModal(d)} className="px-3 py-1 bg-gray-200 rounded">Owner Details</button>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmState({ open: true, message: 'Mark device as stolen?', onConfirm: async () => {
                          try {
                            await updateDoc(doc(db, 'devices', d.id), { status: 'stolen', stolenMarkedBy: auth?.uid || null, stolenMarkedAt: new Date() });
                            // also mark any open flags for this device as 'stolen'
                            try {
                              const fq = query(collection(db, 'flags'), where('deviceID', '==', d.id), where('status', '==', 'open'));
                              const fsnap = await getDocs(fq);
                              const fupdates = fsnap.docs.map(f => updateDoc(doc(db, 'flags', f.id), { status: 'stolen', stolenMarkedAt: serverTimestamp(), stolenMarkedBy: auth?.uid || null }));
                              await Promise.all(fupdates);
                            } catch (fe) { console.error('Failed to update flags on stolen mark', fe); }
                            toast.add('Marked as stolen', { type: 'success' });
                          } catch(e) {
                            toast.add('Failed to mark stolen: ' + e.message, { type: 'error' });
                          } finally { setConfirmState({ open: false, message: '', onConfirm: null }); }
                        } })} className="px-3 py-1 bg-red-700 text-white rounded">Mark Stolen</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            : <p className="col-span-full text-center text-gray-500">No devices found.</p>
          }
        </div>
      );
    }

    if (activeTab === 'security') {
      return (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-full flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Security Personnel</h3>
            <div className="flex gap-2">
              <button onClick={() => setShowInviteModal(true)} className="px-3 py-1 bg-blue-600 text-white rounded">Invite Security</button>
              <button onClick={() => { /* export or refresh maybe */ }} className="px-3 py-1 bg-gray-200 rounded">Refresh</button>
            </div>
          </div>
          {securityUsers.map(user => (
            <div key={user.id} className="p-4 bg-white rounded-xl shadow flex flex-col md:flex-row md:justify-between md:items-center gap-3">
              <div className="min-w-0">
                <p className="font-medium break-words max-w-full">{user.email || user.name || user.id}</p>
                <p className="text-sm text-gray-500 break-words">{user.locationID ? `Loc: ${user.locationID}` : ''}</p>
              </div>
              <span className={`px-2 py-1 rounded text-white text-sm flex-shrink-0 ${user.active ? 'bg-green-500' : 'bg-gray-400'}`}>
                {user.active ? 'Active' : 'Inactive'}
              </span>
              <div className="flex items-center gap-2 mt-2 md:mt-0">
                <button onClick={() => setConfirmState({ open: true, message: 'Delete this security user from Firestore? This will not delete their Firebase Auth account.', onConfirm: async () => { try { await deleteDoc(doc(db, 'users', user.id)); toast.add('Security user removed', { type: 'success' }); } catch (e) { console.error(e); toast.add('Failed to delete user', { type: 'error' }); } finally { setConfirmState({ open: false, message: '', onConfirm: null }); } } })} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Delete</button>
                <button onClick={() => { setEditingUser(user); setShowEditModal(true); }} className="px-3 py-1 bg-yellow-400 text-black rounded text-sm">Edit</button>
              </div>
            </div>
          ))}

          {securityInvites.length > 0 && (
            <div className="col-span-full mt-4">
              <h4 className="text-lg font-semibold mb-2">Pending Invites</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {securityInvites.map(inv => (
                  <div key={inv.id} className="p-3 bg-white rounded shadow flex justify-between items-center">
                    <div>
                      <p className="font-medium">{inv.email}</p>
                      <p className="text-sm text-gray-500">{inv.name || 'Invite'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="px-2 py-1 bg-gray-200 rounded" onClick={() => navigator.clipboard?.writeText(inv.token || '')}>Copy</button>
                      <button className="px-2 py-1 bg-red-600 text-white rounded" onClick={() => setConfirmState({ open: true, message: 'Remove this invite?', onConfirm: async () => { try { await deleteDoc(doc(db, 'securityInvites', inv.id)); toast.add('Invite deleted', { type: 'success' }); } catch (e) { console.error(e); toast.add('Failed to delete invite', { type: 'error' }); } finally { setConfirmState({ open: false, message: '', onConfirm: null }); } } })}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'profile') {
      const createdAt = adminProfile?.createdAt || null;
      let createdStr = '—';
      if (createdAt) {
        if (typeof createdAt.toDate === 'function') createdStr = createdAt.toDate().toLocaleString();
        else if (createdAt.seconds) createdStr = new Date(createdAt.seconds * 1000).toLocaleString();
        else createdStr = new Date(createdAt).toLocaleString();
      }

      return (
        <div className="p-6 max-w-md mx-auto bg-white rounded shadow">
          <h2 className="text-xl font-bold mb-4">Admin Profile</h2>
          <p className="mb-2"><strong>Email:</strong> {adminProfile?.email || '—'}</p>
          <p className="mb-2"><strong>Role:</strong> {adminProfile?.role || 'admin'}</p>
          <p className="mb-2"><strong>Created:</strong> {createdStr}</p>
          <p className="mb-2"><strong>Invites Created:</strong> {invitesCount}</p>
          <p className="mb-2"><strong>Total Devices:</strong> {devicesCount}</p>
        </div>
      );
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
            { label: 'Reports', onClick: () => navigate('/admin/reports') },
          { label: 'Security Personnel', onClick: () => setActiveTab('security') },
        ]}
        profileLink={{ label: 'Profile', onClick: () => setActiveTab('profile') }}
        onLogout={logout}
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

      {showInviteModal && (
        <AddSecurityModal adminUID={auth?.uid} onClose={() => setShowInviteModal(false)} onAdded={() => { /* refresh handled by listener */ }} />
      )}
      {showEditModal && editingUser && (
        <EditSecurityModal user={editingUser} onClose={() => { setShowEditModal(false); setEditingUser(null); }} onSaved={() => { setEditingUser(null); setShowEditModal(false); toast.add('Saved', { type: 'success' }); }} />
      )}
      {confirmState.open && (
        <ConfirmModal message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState({ open: false, message: '', onConfirm: null })} />
      )}
      {ownerModal.open && (
        <UserProfileModal
          owner={ownerModal.owner}
          device={ownerModal.device}
          serialOwner={ownerModal.serialOwner}
          onClose={() => setOwnerModal({ open: false, owner: null, device: null, serialOwner: null })}
          onCheckSerial={() => checkSerialOwner(ownerModal.device?.flaggedSN, ownerModal.device)}
          onReportStolen={async () => {
            try {
              await updateDoc(doc(db, 'devices', ownerModal.device.id), { status: 'stolen', stolenMarkedBy: auth?.uid || null, stolenMarkedAt: new Date() });
              toast.add('Marked as stolen', { type: 'success' });
              setOwnerModal({ open: false, owner: null, device: null, serialOwner: null });
            } catch (e) { console.error(e); toast.add('Failed to mark stolen', { type: 'error' }); }
          }}
          onResolve={async () => { await resolveMismatch(ownerModal.device.id); setOwnerModal({ open: false, owner: null, device: null, serialOwner: null }); }}
        />
      )}
    </div>
  );
}
