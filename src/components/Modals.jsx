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

export function ConfirmModal({ message, title = 'Confirm', onConfirm, onCancel }) {
  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50'>
      <div className='bg-white p-6 rounded-lg'>
        <h3 className='text-lg font-bold mb-2'>{title}</h3>
        <p className='mb-4'>{message}</p>
        <div className='flex gap-2 justify-end'>
          <button onClick={onCancel} className='px-4 py-2 bg-gray-200 rounded'>Cancel</button>
          <button onClick={onConfirm} className='px-4 py-2 bg-red-600 text-white rounded'>Confirm</button>
        </div>
      </div>
    </div>
  );
}

export function UserProfileModal({ owner, device, serialOwner, title = 'Owner Details', onClose, onCheckSerial, onReportStolen, onResolve }) {
  if (!owner) return null;
  return (
    <div className='fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50'>
      <div className='bg-white p-6 rounded-lg w-full max-w-lg'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-bold'>{title}</h3>
          <button onClick={onClose} className='px-2 py-1 bg-gray-200 rounded'>X</button>
        </div>

        <div className='grid grid-cols-1 gap-2'>
          <p><strong>Name:</strong> {owner.name || '—'}</p>
          <p><strong>Email:</strong> {owner.email || '—'}</p>
          <p><strong>Registration No:</strong> {owner.registrationNumber || '—'}</p>
          <p><strong>Phone:</strong> {owner.phone || '—'}</p>
        </div>

        {device?.flaggedSN && (
          <div className='mt-4 p-3 border rounded bg-gray-50'>
            <p><strong>Serial on device:</strong> {device.flaggedSN}</p>
            <div className='mt-2 flex gap-2'>
              <button onClick={onCheckSerial} className='px-3 py-1 bg-blue-600 text-white rounded'>Serial Number Check</button>
            </div>
          </div>
        )}

        {serialOwner && (
          <div className='mt-4 p-3 border rounded bg-white'>
            <h4 className='font-semibold'>Owner registered to serial {device.flaggedSN}</h4>
            <p><strong>Name:</strong> {serialOwner.name || '—'}</p>
            <p><strong>Email:</strong> {serialOwner.email || '—'}</p>
            <p><strong>Registration No:</strong> {serialOwner.registrationNumber || '—'}</p>
            <p><strong>Phone:</strong> {serialOwner.phone || '—'}</p>
            <div className='mt-3 flex gap-2'>
              {serialOwner.id !== owner.id ? (
                <button onClick={onReportStolen} className='px-3 py-1 bg-red-600 text-white rounded'>Report Stolen</button>
              ) : (
                <button onClick={onResolve} className='px-3 py-1 bg-green-600 text-white rounded'>Resolve</button>
              )}
            </div>
          </div>
        )}

        <div className='mt-4 flex justify-end'>
          <button onClick={onClose} className='px-4 py-2 bg-gray-200 rounded'>Close</button>
        </div>
      </div>
    </div>
  );
}
