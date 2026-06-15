import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password');
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen bg-white pt-0">
      <div
        className="w-full flex justify-center py-2 mb-6 cursor-pointer"
        style={{ background: '#131921' }}
        onClick={() => navigate('/')}
      >
        <img
          src="https://links.papareact.com/f90"
          alt="Amazon Logo"
          className="h-9 object-contain"
        />
      </div>

      <div className="w-full max-w-[350px] p-6 border border-gray-300 rounded-md">
        <h1 className="text-3xl font-medium mb-4">Sign in</h1>
        {error && (
          <div className="mb-4 text-red-600 text-sm border border-red-600 p-2 rounded bg-red-50">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Email or mobile phone number</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-1 border border-gray-400 rounded-md focus:outline-none focus:border-amber-500 focus:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)] transition-shadow"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1 flex justify-between">
              <span>Password</span>
              <a href="#" className="text-[#0066c0] hover:text-[#c45500] hover:underline font-normal">Forgot your password?</a>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-1 border border-gray-400 rounded-md focus:outline-none focus:border-amber-500 focus:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)] transition-shadow"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-1.5 bg-[#f0c14b] border border-[#a88734] rounded-md shadow-sm hover:bg-[#ddb347] active:bg-[#d5ab3e] focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
          >
            Sign in
          </button>
        </form>
        <p className="text-xs mt-4">
          By continuing, you agree to Amazon's <a href="#" className="text-[#0066c0] hover:text-[#c45500] hover:underline">Conditions of Use</a> and <a href="#" className="text-[#0066c0] hover:text-[#c45500] hover:underline">Privacy Notice</a>.
        </p>
      </div>

      <div className="w-full max-w-[350px] mt-6 flex items-center justify-center relative">
        <div className="absolute border-b border-gray-300 w-full top-1/2"></div>
        <span className="bg-white px-2 text-xs text-gray-500 relative z-10">New to Amazon?</span>
      </div>

      <button
        onClick={() => navigate('/signup')}
        className="w-full max-w-[350px] mt-3 py-1.5 bg-gray-100 border border-gray-300 rounded-md shadow-sm hover:bg-gray-200 active:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
      >
        Create your Amazon account
      </button>

      <div className="mt-8 border-t border-gray-200 w-full flex flex-col items-center pt-6 bg-gray-50 h-full flex-grow">
        <div className="flex space-x-6 text-xs text-[#0066c0]">
          <a href="#" className="hover:text-[#c45500] hover:underline">Conditions of Use</a>
          <a href="#" className="hover:text-[#c45500] hover:underline">Privacy Notice</a>
          <a href="#" className="hover:text-[#c45500] hover:underline">Help</a>
        </div>
        <p className="text-xs mt-2 text-gray-500">© 1996-2026, Amazon.com, Inc. or its affiliates</p>
      </div>
    </div>
  );
};

export default LoginPage;
