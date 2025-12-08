$src = "C:\Users\HP\Documents\studentsecurity\src"

# Ensure directories
New-Item -Path "$src\components" -ItemType Directory -Force
New-Item -Path "$src\pages" -ItemType Directory -Force

# -----------------------------
# LandingPage.jsx
Set-Content "$src\pages\LandingPage.jsx" @"
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();
    return (
        <div className='min-h-screen flex flex-col items-center justify-center bg-gray-100'>
            <h1 className='text-3xl font-bold mb-6'>Student Device Security</h1>
            <div className='flex flex-col gap-4'>
                <button onClick={() => navigate('/student/auth')} className='bg-blue-500 text-white p-3 rounded'>Student</button>
                <button onClick={() => navigate('/security/login')} className='bg-green-500 text-white p-3 rounded'>Security</button>
                <button onClick={() => navigate('/admin/login')} className='bg-red-500 text-white p-3 rounded'>Admin</button>
            </div>
        </div>
    );
}
"@

# -----------------------------
# TopBar.jsx
Set-Content "$src\components/TopBar.jsx" @"
import React from 'react';

export default function TopBar({ title, rightElements }) {
    return (
        <div className='flex justify-between items-center bg-white p-4 shadow mb-4'>
            <h2 className='text-xl font-bold'>{title}</h2>
            <div className='flex gap-2'>{rightElements}</div>
        </div>
    );
}
"@

# -----------------------------
# SecurityLogin.jsx
Set-Content "$src\components/SecurityLogin.jsx" @"
import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function SecurityLogin({ setSecurityUID }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async () => {
        if(!email || !password) return alert('Email & password required');
        try {
            const res = await signInWithEmailAndPassword(auth, email, password);
            setSecurityUID(res.user.uid);
            navigate('/security/home');
        } catch(err) { console.error(err); alert(err.message); }
    };

    return (
        <div className='min-h-screen flex items-center justify-center bg-gray-100'>
            <div className='bg-white p-6 rounded-lg shadow-md w-80'>
                <h2 className='text-xl font-bold mb-4'>Security Login</h2>
                <input type='email' placeholder='Email' value={email} onChange={e => setEmail(e.target.value)} className='border p-2 w-full mb-2'/>
                <input type='password' placeholder='Password' value={password} onChange={e => setPassword(e.target.value)} className='border p-2 w-full mb-4'/>
                <button onClick={handleLogin} className='bg-blue-500 text-white p-2 rounded w-full'>Login</button>
            </div>
        </div>
    );
}
"@

# -----------------------------
# SecurityHome.jsx
Set-Content "$src\pages/SecurityHome.jsx" @"
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, updateDoc, doc } from 'firebase/firestore';
import DeviceCard from '../components/DeviceCard';
import TopBar from '../components/TopBar';

export default function SecurityHome({ securityUID }) {
    const [devices, setDevices] = useState([]);
    const [viewAllowed, setViewAllowed] = useState(false);

    useEffect(() => {
        if(!securityUID) return;
        const q = query(collection(db, 'devices'));
        const unsub = onSnapshot(q, snap => {
            setDevices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [securityUID]);

    const handleClockIn = async (deviceId) => {
        await updateDoc(doc(db, 'devices', deviceId), { status: 'in_school' });
    };

    const handleClockOut = async (deviceId) => {
        await updateDoc(doc(db, 'devices', deviceId), { status: 'out_of_school' });
    };

    const rightElements = (
        <>
            <button onClick={() => setViewAllowed(false)} className='bg-blue-500 text-white p-2 rounded'>Scan Devices</button>
            <button onClick={() => setViewAllowed(true)} className='bg-green-500 text-white p-2 rounded'>Allowed Devices</button>
        </>
    );

    return (
        <div className='min-h-screen bg-gray-100 p-4'>
            <TopBar title='Security Dashboard' rightElements={rightElements} />
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                {devices.filter(d => viewAllowed ? d.status === 'in_school' : true).map(device => (
                    <DeviceCard key={device.id} device={device} />
                ))}
            </div>
        </div>
    );
}
"@

# -----------------------------
# AdminLogin.jsx
Set-Content "$src\components/AdminLogin.jsx" @"
import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin({ setAdminUID }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleLogin = async () => {
        if(!email || !password) return alert('Email & password required');
        try {
            const res = await signInWithEmailAndPassword(auth, email, password);
            setAdminUID(res.user.uid);
            navigate('/admin/dashboard');
        } catch(err) { console.error(err); alert(err.message); }
    };

    return (
        <div className='min-h-screen flex items-center justify-center bg-gray-100'>
            <div className='bg-white p-6 rounded-lg shadow-md w-80'>
                <h2 className='text-xl font-bold mb-4'>Admin Login</h2>
                <input type='email' placeholder='Email' value={email} onChange={e => setEmail(e.target.value)} className='border p-2 w-full mb-2'/>
                <input type='password' placeholder='Password' value={password} onChange={e => setPassword(e.target.value)} className='border p-2 w-full mb-4'/>
                <button onClick={handleLogin} className='bg-red-500 text-white p-2 rounded w-full'>Login</button>
            </div>
        </div>
    );
}
"@

# -----------------------------
# AdminDashboard.jsx
Set-Content "$src\pages/AdminDashboard.jsx" @"
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import DeviceCard from '../components/DeviceCard';
import TopBar from '../components/TopBar';

export default function AdminDashboard({ adminUID }) {
    const [devices, setDevices] = useState([]);
    const [mismatches, setMismatches] = useState([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'devices'), snap => {
            setDevices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setMismatches(snap.docs.filter(d => !d.data().ownerUID || !d.data().schoolID).map(d => d.data()));
        });
        return () => unsub();
    }, []);

    const rightElements = (
        <span className='text-red-500 font-bold'>Mismatches: {mismatches.length}</span>
    );

    return (
        <div className='min-h-screen bg-gray-100 p-4'>
            <TopBar title='Admin Dashboard' rightElements={rightElements} />
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
                {devices.map(device => (
                    <DeviceCard key={device.id} device={device} />
                ))}
            </div>
        </div>
    );
}
"@

Write-Host "✅ All Student/Security/Admin pages & components updated successfully!"
