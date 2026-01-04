import React, { useState, useEffect } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useToast } from './Toast';

export default function EditSecurityModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user?.name || '');
  const [locationID, setLocationID] = useState(user?.locationID || '');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setName(user?.name || '');
    setLocationID(user?.locationID || '');
  }, [user]);

  if (!user) return null;

  const save = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { name: name || null, locationID: locationID || null });
      toast.add('Saved changes', { type: 'success' });
      onSaved && onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.add('Failed to save changes', { type: 'error' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Edit Security</h2>
          <button onClick={onClose} className="px-3 py-1 bg-gray-200 rounded">X</button>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-gray-700 mb-1">Email</label>
          <div className="text-sm text-gray-900">{user.email}</div>
        </div>

        <div className="mb-3">
          <label className="block text-sm text-gray-700 mb-1">Full name</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2 border rounded" />
        </div>

        <div className="mb-3">
          <label className="block text-sm text-gray-700 mb-1">Location ID</label>
          <input value={locationID} onChange={e => setLocationID(e.target.value)} className="w-full px-3 py-2 border rounded" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
          <button onClick={save} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
