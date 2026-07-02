import React from 'react';
import { useNavigate } from 'react-router-dom';

// Amazon "create account" style entry screen. Any Next click enters the console.
export default function SellerSignIn() {
  const nav = useNavigate();
  const enter = () => nav('/seller');
  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 4, background: '#131a22' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 16px 40px' }}>
        <div style={{ margin: '8px 0 22px' }}>
          <svg width="366" height="70" viewBox="0 0 366 70" fill="none">
            <text x="0" y="46" fontFamily="Arial,Helvetica,sans-serif" fontSize="46" fontWeight="700" letterSpacing="-1" fill="#131a22">amazon</text>
            <path d="M6 52 C 55 70, 135 70, 172 53" stroke="#FF9900" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M172 53 l 3 -9 l -12 3 Z" fill="#FF9900" />
            <text x="182" y="46" fontFamily="Arial,Helvetica,sans-serif" fontSize="30" fontWeight="400" fill="#131a22">seller central</text>
          </svg>
        </div>
        <div style={{ width: 350, maxWidth: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '20px 24px 26px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 400, margin: '0 0 16px' }}>Create account</h1>
          <Field label="Your name" placeholder="First and last name" focused />
          <Field label="Email" />
          <Field label="Password" type="password" placeholder="At least 6 characters" mb={6} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#0066c0', marginBottom: 12 }}>
            <span style={{ display: 'inline-flex', width: 15, height: 15, borderRadius: '50%', background: '#0066c0', color: '#fff', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontWeight: 700, fontSize: 10 }}>i</span>
            <span style={{ color: '#111' }}>Passwords must be at least 6 characters.</span>
          </div>
          <Field label="Re-enter password" type="password" mb={18} />
          <button onClick={enter} style={{ width: '100%', height: 36, background: 'linear-gradient(180deg,#f7dfa5,#f0c14b)', border: '1px solid #a88734', borderBottomColor: '#9c7e31', borderRadius: 3, fontSize: 14, color: '#111', cursor: 'pointer' }}>Next</button>
          <div style={{ height: 1, background: '#e7e7e7', margin: '20px 0 14px' }} />
          <div style={{ fontSize: 13 }}>Already have an account? <span onClick={enter} className="sc-link">Sign in</span></div>
        </div>
      </div>
      <div style={{ height: 70, background: '#131a22' }} />
    </div>
  );
}

function Field({ label, placeholder, type = 'text', focused, mb = 12 }) {
  const border = focused ? '1px solid #e77600' : '1px solid #a6a6a6';
  const shadow = focused ? '0 0 3px 2px rgba(228,121,17,.3)' : 'none';
  return (
    <div style={{ marginBottom: mb }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <input type={type} placeholder={placeholder} style={{ width: '100%', height: 38, border, boxShadow: shadow, borderRadius: 3, padding: '0 8px', fontSize: 14, boxSizing: 'border-box' }} />
    </div>
  );
}
