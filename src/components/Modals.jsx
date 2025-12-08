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
