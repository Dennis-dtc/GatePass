import React from 'react';
import DeviceCard from './DeviceCard';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';

export default function QRModal({ value, onClose, securityMode }) {
  const handleVerifyAll = async () => {
    if (!value?.devices?.length) return;
    for (const device of value.devices) {
      await updateDoc(doc(db, 'devices', device.id), {
        status: 'in_school',
        lastVerifiedAt: new Date()
      });
    }
    onClose();
  };

  const handleClockOutAll = async () => {
    if (!value?.devices?.length) return;
    for (const device of value.devices) {
      await updateDoc(doc(db, 'devices', device.id), {
        status: 'out_school',
        lastVerifiedAt: new Date()
      });
    }
    onClose();
  };

  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50'>
      <div className='bg-white p-6 rounded-lg max-w-2xl w-full'>
        <button onClick={onClose} className='mb-4 px-3 py-1 bg-red-500 text-white rounded'>X</button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {value?.devices?.map(d => <DeviceCard key={d.id} device={d} />)}
        </div>

        {securityMode && (
          <div className="mt-4 flex justify-center gap-4">
            <button onClick={handleVerifyAll} className="px-4 py-2 bg-green-600 text-white rounded">Verify / Clock In All</button>
            <button onClick={handleClockOutAll} className="px-4 py-2 bg-red-600 text-white rounded">Clock Out All</button>
          </div>
        )}
      </div>
    </div>
  );
}
