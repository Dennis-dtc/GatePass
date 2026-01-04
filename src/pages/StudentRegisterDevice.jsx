import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '../components/Toast';

export default function StudentRegisterDevice({ onDone }) {
  const toast = useToast();
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [deviceSN, setDeviceSN] = useState('');
  const [deviceModel, setDeviceModel] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const user = auth.currentUser;
    if (!user) { 
      toast.add('Not authenticated', { type: 'error' }); 
      return; 
    }

    if (!registrationNumber || !deviceSN) {
      toast.add('Please fill in registration number and device serial number.', { type: 'error' });
      return;
    }

    try {
      await addDoc(collection(db, 'devices'), {
        ownerUID: user.uid,
        ownerEmail: user.email || null,
        registrationNumber,       // updated field
        deviceSN,
        deviceModel: deviceModel || 'Unknown',
        status: 'out_of_school',
        createdAt: serverTimestamp(),
        lastVerifiedAt: null,
        lastVerifiedBy: null,
        snMismatch: false
      });

      onDone && onDone();
      setRegistrationNumber('');
      setDeviceSN('');
      setDeviceModel('');
    } catch (err) {
      console.error(err);
      toast.add('Failed to register device: ' + err.message, { type: 'error' });
    }
  };

  return (
    <div className='max-w-md mx-auto p-6 bg-white rounded-xl shadow'>
      <h2 className='text-xl font-bold mb-4'>Register a Device</h2>
      <form onSubmit={handleSubmit} className='flex flex-col gap-3'>
        <input
          className='p-3 border rounded'
          placeholder='Registration Number'
          value={registrationNumber}
          onChange={e => setRegistrationNumber(e.target.value)}
          required
        />
        <input
          className='p-3 border rounded'
          placeholder='Device Serial Number'
          value={deviceSN}
          onChange={e => setDeviceSN(e.target.value)}
          required
        />
        <input
          className='p-3 border rounded'
          placeholder='Device Model (optional)'
          value={deviceModel}
          onChange={e => setDeviceModel(e.target.value)}
        />
        <button type='submit' className='mt-3 bg-green-600 text-white py-2 rounded hover:bg-green-700'>
          Register Device
        </button>
      </form>
    </div>
  );
}
