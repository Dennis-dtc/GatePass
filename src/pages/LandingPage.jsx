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
