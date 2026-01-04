import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function EditProfileModal({ user, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const toast = useToast();

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setPhone(user.phone || '');
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.id), { name: name.trim() || null, phone: phone.trim() || null });
      toast.add('Profile updated', { type: 'success' });
      onSaved && onSaved();
      onClose && onClose();
    } catch (e) {
      console.error(e);
      toast.add('Failed to update profile', { type: 'error' });
    }
  };

  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50'>
      <div className='bg-white p-6 rounded-lg w-full max-w-md'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-bold'>Edit Profile</h3>
          <button onClick={onClose} className='px-2 py-1 bg-gray-200 rounded'>X</button>
        </div>

        <div className='space-y-3'>
          <div>
            <label className='block text-sm text-gray-700'>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className='mt-1 p-2 border rounded w-full' />
          </div>

          <div>
            <label className='block text-sm text-gray-700'>Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} className='mt-1 p-2 border rounded w-full' />
          </div>

          <div className='flex justify-end gap-2'>
            <button className='px-4 py-2 bg-gray-200 rounded' onClick={onClose}>Cancel</button>
            <button className='px-4 py-2 bg-blue-600 text-white rounded' onClick={handleSave}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
