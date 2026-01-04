import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from './Toast';

export default function AddSecurityModal({ onClose, onAdded, adminUID }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [locationID, setLocationID] = useState('');

  const toast = useToast();

  const createInvite = async () => {
    if (!email) {
      toast.add('Email is required', { type: 'error' });
      return;
    }

    try {
      const token = Math.random().toString(36).slice(2, 10);
      await addDoc(collection(db, 'securityInvites'), {
        name: name || null,
        email,
        locationID: locationID || null,
        invitedBy: adminUID || null,
        token,
        status: 'pending',
        invitedAt: new Date()
      });

      toast.add('Invite created', { type: 'success' });
      onAdded && onAdded();
      onClose();
    } catch (err) {
      toast.add('Failed to create invite: ' + err.message, { type: 'error' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <button onClick={onClose} className="self-end mb-4 px-3 py-1 bg-red-500 text-white rounded">X</button>
        <h2 className="text-xl font-bold mb-2">Invite Security Personnel</h2>

        <input type="text" placeholder="Full name (optional)" value={name} onChange={e=>setName(e.target.value)} className="mb-2 px-3 py-2 border rounded w-full" />
        <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} className="mb-2 px-3 py-2 border rounded w-full" />
        <input type="text" placeholder="Location ID (optional)" value={locationID} onChange={e=>setLocationID(e.target.value)} className="mb-4 px-3 py-2 border rounded w-full" />

        <div className="flex items-center justify-between gap-2">
          <button onClick={createInvite} className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700">Create Invite</button>
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
        </div>
      </div>
    </div>
  );
}
