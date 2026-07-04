import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SignupPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== passwordAgain) {
      setError('Passwords must match');
      return;
    }
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      if (err.response?.data) {
        const data = err.response.data;
        const errorMsg = data.email?.[0] || data.password?.[0] || data.name?.[0] || data.error || 'An error occurred during registration';
        setError(errorMsg);
      } else {
        setError('An error occurred during registration');
      }
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
        <h1 className="text-3xl font-medium mb-4">Create account</h1>
        {error && (
          <div className="mb-4 text-red-600 text-sm border border-red-600 p-2 rounded bg-red-50">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Your name</label>
            <input
              type="text"
              placeholder="First and last name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1 border border-gray-400 rounded-md focus:outline-none focus:border-amber-500 focus:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)] transition-shadow"
              required
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Mobile number or email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-1 border border-gray-400 rounded-md focus:outline-none focus:border-amber-500 focus:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)] transition-shadow"
              required
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">Password</label>
            <input
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-1 border border-gray-400 rounded-md focus:outline-none focus:border-amber-500 focus:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)] transition-shadow"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1 flex items-center">
              <span className="text-[#0066c0] mr-1 text-lg leading-none italic font-serif">i</span> Passwords must be at least 6 characters.
            </p>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Re-enter password</label>
            <input
              type="password"
              value={passwordAgain}
              onChange={(e) => setPasswordAgain(e.target.value)}
              className="w-full px-3 py-1 border border-gray-400 rounded-md focus:outline-none focus:border-amber-500 focus:shadow-[0_0_3px_2px_rgba(228,121,17,0.5)] transition-shadow"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-1.5 bg-[#f0c14b] border border-[#a88734] rounded-md shadow-sm hover:bg-[#ddb347] active:bg-[#d5ab3e] focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm mt-2"
          >
            Continue
          </button>
        </form>
        <p className="text-xs mt-4">
          By creating an account, you agree to Amazon's <a href="#" className="text-[#0066c0] hover:text-[#c45500] hover:underline">Conditions of Use</a> and <a href="#" className="text-[#0066c0] hover:text-[#c45500] hover:underline">Privacy Notice</a>.
        </p>

        <div className="mt-6 border-t border-gray-200 pt-4">
          <p className="text-sm">
            Already have an account? <Link to="/login" className="text-[#0066c0] hover:text-[#c45500] hover:underline">Sign in <span className="text-gray-500 text-xs">▶</span></Link>
          </p>
          <p className="text-sm mt-1">
            Buying for work? <a href="#" className="text-[#0066c0] hover:text-[#c45500] hover:underline">Create a free business account <span className="text-gray-500 text-xs">▶</span></a>
          </p>
        </div>
      </div>

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

export default SignupPage;
