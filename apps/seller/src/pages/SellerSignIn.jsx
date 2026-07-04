import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSellerAuth } from '../SellerAuthContext';

// Amazon Seller Central sign-in / create-account entry screen, wired to the
// real seller auth endpoints. Toggles between "Sign in" and "Create account".
export default function SellerSignIn() {
  const nav = useNavigate();
  const { login, register } = useSellerAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isRegister && password !== password2) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        await register(name, email, password, storeName);
      } else {
        await login(email, password);
      }
      nav('/seller');
    } catch (err) {
      const data = err.response?.data;
      const msg =
        data?.error ||
        data?.email?.[0] ||
        data?.password?.[0] ||
        data?.name?.[0] ||
        (isRegister ? 'Could not create account.' : 'Invalid email or password.');
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

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
        <form onSubmit={submit} style={{ width: 350, maxWidth: '100%', border: '1px solid #ddd', borderRadius: 8, padding: '20px 24px 26px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 400, margin: '0 0 16px' }}>
            {isRegister ? 'Create account' : 'Sign in'}
          </h1>

          {error && (
            <div style={{ background: '#fff0f0', border: '1px solid #c40000', color: '#c40000', fontSize: 13, borderRadius: 4, padding: '8px 10px', marginBottom: 14 }}>
              {error}
            </div>
          )}

          {isRegister && (
            <>
              <Field label="Your name" placeholder="First and last name" value={name} onChange={setName} />
              <Field label="Store name (optional)" placeholder="e.g. Aarav Retail" value={storeName} onChange={setStoreName} />
            </>
          )}
          <Field label="Email" type="email" value={email} onChange={setEmail} />
          <Field
            label="Password"
            type="password"
            placeholder={isRegister ? 'At least 6 characters' : undefined}
            value={password}
            onChange={setPassword}
            mb={isRegister ? 6 : 18}
          />
          {isRegister && (
            <>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, marginBottom: 12 }}>
                <span style={{ display: 'inline-flex', width: 15, height: 15, borderRadius: '50%', background: '#0066c0', color: '#fff', alignItems: 'center', justifyContent: 'center', fontStyle: 'italic', fontWeight: 700, fontSize: 10 }}>i</span>
                <span style={{ color: '#111' }}>Passwords must be at least 6 characters.</span>
              </div>
              <Field label="Re-enter password" type="password" value={password2} onChange={setPassword2} mb={18} />
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{ width: '100%', height: 36, background: 'linear-gradient(180deg,#f7dfa5,#f0c14b)', border: '1px solid #a88734', borderBottomColor: '#9c7e31', borderRadius: 3, fontSize: 14, color: '#111', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? 'Please wait…' : isRegister ? 'Create your seller account' : 'Sign in'}
          </button>

          <div style={{ height: 1, background: '#e7e7e7', margin: '20px 0 14px' }} />
          {isRegister ? (
            <div style={{ fontSize: 13 }}>
              Already selling on Amazon?{' '}
              <span onClick={() => { setMode('signin'); setError(''); }} className="sc-link">Sign in</span>
            </div>
          ) : (
            <div style={{ fontSize: 13 }}>
              New seller?{' '}
              <span onClick={() => { setMode('register'); setError(''); }} className="sc-link">Create your account</span>
            </div>
          )}
        </form>
      </div>
      <div style={{ height: 70, background: '#131a22' }} />
    </div>
  );
}

function Field({ label, placeholder, type = 'text', value, onChange, mb = 12 }) {
  const [focused, setFocused] = useState(false);
  const border = focused ? '1px solid #e77600' : '1px solid #a6a6a6';
  const shadow = focused ? '0 0 3px 2px rgba(228,121,17,.3)' : 'none';
  return (
    <div style={{ marginBottom: mb }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={!label.includes('optional')}
        minLength={type === 'password' ? 6 : undefined}
        style={{ width: '100%', height: 38, border, boxShadow: shadow, borderRadius: 3, padding: '0 8px', fontSize: 14, boxSizing: 'border-box' }}
      />
    </div>
  );
}
