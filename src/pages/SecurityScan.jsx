import React, { useRef, useEffect, useState } from 'react';
import QrScanner from 'qr-scanner';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

QrScanner.WORKER_PATH = 'https://unpkg.com/qr-scanner@1.4.2/qr-scanner-worker.min.js';

export default function SecurityScan({ securityUID, securityName }) {
  const videoRef = useRef(null);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const scanner = new QrScanner(videoRef.current, result => onScan(result));
    scanner.start().catch(err => console.warn('camera start failed', err));
    return () => scanner.destroy();
    // eslint-disable-next-line
  }, []);

  async function onScan(result) {
    if (!result) return;
    try {
      const parsed = JSON.parse(result);
      // parsed: { deviceID, ownerUID }
      const deviceRef = doc(db, 'devices', parsed.deviceID);
      const snap = await getDoc(deviceRef);
      if(!snap.exists()){ alert('Device not found'); return; }
      const device = { id: snap.id, ...snap.data() };
      setCurrent({ parsed, device });
    } catch (err) {
      console.warn('invalid qr', err);
    }
  }

  async function verifyManual(scannedSN) {
    if(!current) return;
    const { device } = current;
    const deviceRef = doc(db, 'devices', device.id);

    const isMatch = device.deviceSN === scannedSN;
    await updateDoc(deviceRef, {
      status: isMatch ? 'in_school' : device.status,
      lastVerifiedAt: serverTimestamp(),
      lastVerifiedBy: securityUID,
      snMismatch: isMatch ? false : true
    });

    await addDoc(collection(db, 'logs'), {
      deviceID: device.id,
      ownerUID: device.ownerUID,
      scannedSN,
      expectedSN: device.deviceSN,
      isMatch,
      securityUID,
      securityName,
      timestamp: serverTimestamp()
    });

    alert(isMatch ? 'Verified - marked In School' : 'Mismatch logged');
    setCurrent(null);
  }

  return (
    <div className='min-h-screen bg-gray-100 p-6'>
      <h1 className='text-2xl font-bold mb-4'>Gate — Scan QR</h1>
      <div className='grid md:grid-cols-2 gap-6'>
        <div>
          <video ref={videoRef} className='w-full rounded-md border' />
          <p className='text-sm mt-2 text-gray-600'>Point camera at student's QR</p>
        </div>

        <div>
          {current ? (
            <div className='p-4 bg-white rounded shadow'>
              <h3 className='font-semibold mb-2'>Student Device</h3>
              <p>Model: {current.device.deviceModel}</p>
              <p>Registered SN: {current.device.deviceSN}</p>

              <div className='mt-3'>
                <label className='block text-sm'>Enter SN observed on laptop</label>
                <input id='manualSN' className='p-2 border rounded w-full mt-1' placeholder='Type SN shown on laptop' />
                <button onClick={() => verifyManual(document.getElementById('manualSN').value)} className='mt-3 bg-blue-600 text-white py-2 px-4 rounded'>Verify</button>
              </div>
            </div>
          ) : (
            <div className='p-4 bg-white rounded shadow'>
              <p className='text-sm text-gray-600'>Waiting for QR scan...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
