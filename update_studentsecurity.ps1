# =================================================
# PowerShell Script: update_studentsecurity.ps1
# Creates/overwrites the complete src/ folder
# with components, pages, Firebase config, and CSS
# =================================================

$srcPath = ".\src"

# Create src folder if it doesn't exist
if (!(Test-Path $srcPath)) {
    New-Item -ItemType Directory -Path $srcPath
}

# ======================================
# index.css
# ======================================
@"
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
    @apply bg-gray-100 text-gray-900 font-sans;
}
"@ | Out-File "$srcPath\index.css" -Encoding utf8

# ======================================
# main.jsx
# ======================================
@"
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
"@ | Out-File "$srcPath\main.jsx" -Encoding utf8

# ======================================
# firebase.js
# ======================================
@"
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCgQzrS-AZq3wV9bjN1Bg3BVl-Wv-0ZjaI',
  authDomain: 'studentsecurity.firebaseapp.com',
  projectId: 'studentsecurity',
  storageBucket: 'studentsecurity.appspot.com',
  messagingSenderId: '1020075356244',
  appId: '1:1020075356244:web:88d778d63f851ddf0abdc1'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
"@ | Out-File "$srcPath\firebase.js" -Encoding utf8

# ======================================
# Components folder
# ======================================
$componentsPath = "$srcPath\components"
if (!(Test-Path $componentsPath)) { New-Item -ItemType Directory -Path $componentsPath }

# -------- LandingPage.jsx --------
@"
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div className='min-h-screen flex flex-col justify-center items-center bg-gray-100'>
      <h1 className='text-4xl font-bold mb-8'>Device Security System</h1>
      <div className='space-x-4'>
        <button onClick={() => navigate('/student')} className='px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600'>Student</button>
        <button onClick={() => navigate('/security')} className='px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600'>Security</button>
        <button onClick={() => navigate('/admin')} className='px-6 py-3 bg-red-500 text-white rounded hover:bg-red-600'>Admin</button>
      </div>
    </div>
  );
}
"@ | Out-File "$componentsPath\LandingPage.jsx" -Encoding utf8

# -------- StudentAuth.jsx --------
@"
import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function StudentAuth({ setStudentUID }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [schoolID, setSchoolID] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();

  const handleSignup = async () => {
    if(!email || !password || !schoolID) return alert('Fill all fields');
    const userCred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', userCred.user.uid), {
      email,
      schoolID,
      role: 'student'
    });
    setStudentUID(userCred.user.uid);
    navigate('/student/home');
  }

  const handleLogin = async () => {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const docSnap = await getDoc(doc(db, 'users', userCred.user.uid));
    if(!docSnap.exists()) return alert('No user found');
    setStudentUID(userCred.user.uid);
    navigate('/student/home');
  }

  return (
    <div className='min-h-screen flex flex-col justify-center items-center bg-gray-100'>
      <h2 className='text-2xl font-bold mb-4'>{isLogin ? 'Student Login' : 'Student Signup'}</h2>
      <input type='text' placeholder='School ID' value={schoolID} onChange={e=>setSchoolID(e.target.value)} className='mb-2 px-4 py-2 border rounded'/>
      <input type='email' placeholder='Email' value={email} onChange={e=>setEmail(e.target.value)} className='mb-2 px-4 py-2 border rounded'/>
      <input type='password' placeholder='Password' value={password} onChange={e=>setPassword(e.target.value)} className='mb-4 px-4 py-2 border rounded'/>
      <button onClick={isLogin ? handleLogin : handleSignup} className='px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>{isLogin ? 'Login' : 'Signup'}</button>
      <p className='mt-4 cursor-pointer text-blue-700' onClick={()=>setIsLogin(!isLogin)}>{isLogin ? 'Create account?' : 'Already have account?'}</p>
    </div>
  );
}
"@ | Out-File "$componentsPath\StudentAuth.jsx" -Encoding utf8

# -------- SecurityLogin.jsx --------
@"
import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function SecurityLogin({ setSecurityUID }) {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    const userCred = await signInWithEmailAndPassword(auth,email,password);
    setSecurityUID(userCred.user.uid);
    navigate('/security/home');
  }

  return (
    <div className='min-h-screen flex flex-col justify-center items-center bg-gray-100'>
      <h2 className='text-2xl font-bold mb-4'>Security Login</h2>
      <input type='email' placeholder='Email' value={email} onChange={e=>setEmail(e.target.value)} className='mb-2 px-4 py-2 border rounded'/>
      <input type='password' placeholder='Password' value={password} onChange={e=>setPassword(e.target.value)} className='mb-4 px-4 py-2 border rounded'/>
      <button onClick={handleLogin} className='px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600'>Login</button>
    </div>
  );
}
"@ | Out-File "$componentsPath\SecurityLogin.jsx" -Encoding utf8

# -------- AdminLogin.jsx --------
@"
import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin({ setAdminUID }) {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async () => {
    const userCred = await signInWithEmailAndPassword(auth,email,password);
    setAdminUID(userCred.user.uid);
    navigate('/admin/dashboard');
  }

  return (
    <div className='min-h-screen flex flex-col justify-center items-center bg-gray-100'>
      <h2 className='text-2xl font-bold mb-4'>Admin Login</h2>
      <input type='email' placeholder='Email' value={email} onChange={e=>setEmail(e.target.value)} className='mb-2 px-4 py-2 border rounded'/>
      <input type='password' placeholder='Password' value={password} onChange={e=>setPassword(e.target.value)} className='mb-4 px-4 py-2 border rounded'/>
      <button onClick={handleLogin} className='px-6 py-2 bg-red-500 text-white rounded hover:bg-red-600'>Login</button>
    </div>
  );
}
"@ | Out-File "$componentsPath\AdminLogin.jsx" -Encoding utf8

# -------- QRCodeDisplay.jsx --------
@"
import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';

export default function QRCodeDisplay({ value, onClose }) {
  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50'>
      <div className='bg-white p-6 rounded-lg flex flex-col items-center'>
        <button onClick={onClose} className='self-end mb-4 px-3 py-1 bg-red-500 text-white rounded'>X</button>
        <QRCodeCanvas value={JSON.stringify(value)} size={300}/>
      </div>
    </div>
  );
}
"@ | Out-File "$componentsPath\QRCodeDisplay.jsx" -Encoding utf8

# -------- TopBar.jsx --------
@"
import React from 'react';

export default function TopBar({ title, actions }) {
  return (
    <div className='w-full bg-white shadow flex justify-between items-center p-4'>
      <h1 className='text-xl font-bold'>{title}</h1>
      <div className='space-x-2 flex'>
        {actions?.map((a,i)=><button key={i} onClick={a.onClick} className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>{a.label}</button>)}
      </div>
    </div>
  );
}
"@ | Out-File "$componentsPath\TopBar.jsx" -Encoding utf8

# -------- DeviceCard.jsx --------
@"
import React from 'react';

export default function DeviceCard({ device }) {
  return (
    <div className='p-4 bg-white rounded-xl shadow text-center'>
      <p className='font-semibold'>{device.deviceModel || 'Unknown Device'}</p>
      <p className='text-sm'>SN: {device.deviceSN}</p>
      <p className='text-sm'>School ID: {device.schoolID}</p>
      <p className='text-sm'>Status: {device.status === 'in_school' ? 'In School' : 'Out of School'}</p>
    </div>
  );
}
"@ | Out-File "$componentsPath\DeviceCard.jsx" -Encoding utf8

# -------- Modals.jsx --------
@"
import React from 'react';
import QRCodeDisplay from './QRCodeDisplay';

export function QRModal({ value, onClose }) {
  return <QRCodeDisplay value={value} onClose={onClose}/>;
}

export function AddDeviceModal({ onSubmit, onClose }) {
  const [deviceModel,setDeviceModel] = React.useState('');
  const [deviceSN,setDeviceSN] = React.useState('');
  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50'>
      <div className='bg-white p-6 rounded-lg'>
        <button onClick={onClose} className='self-end mb-4 px-3 py-1 bg-red-500 text-white rounded'>X</button>
        <h2 className='text-xl font-bold mb-2'>Register Device</h2>
        <input type='text' placeholder='Device Model' value={deviceModel} onChange={e=>setDeviceModel(e.target.value)} className='mb-2 px-3 py-2 border rounded w-full'/>
        <input type='text' placeholder='Device SN' value={deviceSN} onChange={e=>setDeviceSN(e.target.value)} className='mb-4 px-3 py-2 border rounded w-full'/>
        <button onClick={()=>onSubmit({deviceModel,deviceSN})} className='px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>Add Device</button>
      </div>
    </div>
  );
}
"@ | Out-File "$componentsPath\Modals.jsx" -Encoding utf8

# ======================================
# Pages folder
# ======================================
$pagesPath = "$srcPath\pages"
if (!(Test-Path $pagesPath)) { New-Item -ItemType Directory -Path $pagesPath }

# -------- StudentHome.jsx --------
@"
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import TopBar from '../components/TopBar';
import DeviceCard from '../components/DeviceCard';
import { AddDeviceModal, QRModal } from '../components/Modals';

export default function StudentHome({ studentUID, schoolID }) {
  const [devices, setDevices] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [currentQR, setCurrentQR] = useState(null);

  useEffect(() => {
    if(!studentUID) return;
    const q = query(collection(db,'devices'), where('ownerUID','==',studentUID));
    const unsub = onSnapshot(q, snap=>setDevices(snap.docs.map(d=>({id:d.id, ...d.data()}))));
    return ()=>unsub();
  },[studentUID]);

  const handleAddDevice = async ({deviceModel,deviceSN})=>{
    await addDoc(collection(db,'devices'),{
      deviceModel,
      deviceSN,
      ownerUID: studentUID,
      schoolID,
      status: 'out_school'
    });
    setShowAdd(false);
  }

  return (
    <div className='min-h-screen bg-gray-100'>
      <TopBar title='Student Home' actions={[
        {label:'Add Device', onClick:()=>setShowAdd(true)},
        {label:'My QR Code', onClick:()=>{setCurrentQR({studentUID, devices}); setShowQR(true);}}
      ]}/>
      <div className='p-6 grid grid-cols-1 md:grid-cols-3 gap-6'>
        {devices.map(d=><DeviceCard key={d.id} device={d}/>)}
      </div>
      {showAdd && <AddDeviceModal onSubmit={handleAddDevice} onClose={()=>setShowAdd(false)}/>}
      {showQR && <QRModal value={currentQR} onClose={()=>setShowQR(false)}/>}
    </div>
  );
}
"@ | Out-File "$pagesPath\StudentHome.jsx" -Encoding utf8

# -------- SecurityHome.jsx --------
@"
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import TopBar from '../components/TopBar';
import DeviceCard from '../components/DeviceCard';
import { QRModal } from '../components/Modals';

export default function SecurityHome({ securityUID }) {
  const [devices, setDevices] = useState([]);
  const [showQR, setShowQR] = useState(false);
  const [currentQR, setCurrentQR] = useState(null);

  useEffect(()=>{
    const q = query(collection(db,'devices'), where('status','==','in_school'));
    const unsub = onSnapshot(q, snap=>setDevices(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>unsub();
  },[]);

  const handleVerify = async (device)=>{
    await updateDoc(doc(db,'devices',device.id),{status:'in_school',lastScannedBy:securityUID});
    alert('Device verified!');
  }

  return (
    <div className='min-h-screen bg-gray-100'>
      <TopBar title='Security Home' actions={[{label:'Allowed Devices', onClick:()=>{}}]}/>
      <div className='p-6 grid grid-cols-1 md:grid-cols-3 gap-6'>
        {devices.map(d=><DeviceCard key={d.id} device={d}/>)}
      </div>
      {showQR && <QRModal value={currentQR} onClose={()=>setShowQR(false)}/>}
    </div>
  );
}
"@ | Out-File "$pagesPath\SecurityHome.jsx" -Encoding utf8

# -------- AdminDashboard.jsx --------
@"
import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import TopBar from '../components/TopBar';
import DeviceCard from '../components/DeviceCard';

export default function AdminDashboard() {
  const [devices, setDevices] = useState([]);
  useEffect(()=>{
    const unsub = onSnapshot(collection(db,'devices'), snap=>setDevices(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>unsub();
  },[]);
  return (
    <div className='min-h-screen bg-gray-100'>
      <TopBar title='Admin Dashboard' actions={[]}/>
      <div className='p-6 grid grid-cols-1 md:grid-cols-3 gap-6'>
        {devices.map(d=><DeviceCard key={d.id} device={d}/>)}
      </div>
    </div>
  );
}
"@ | Out-File "$pagesPath\AdminDashboard.jsx" -Encoding utf8

Write-Host "✅ All src files created/updated successfully. Run 'npm run dev' to test your app."
