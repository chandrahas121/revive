// hooks/useLocation.js
// v2 — live location capture (final_idea_v2.md §4.4 + S0). Asks the browser for
// the user's current location, persists it (localStorage), and exposes it for
// the storefront "Near me" sort and the Sell It / demand-signal calls.
//
// NOTE: the artifact sandbox forbids localStorage, but this is a real app file
// (Vite/React), where localStorage is the right place to remember the choice.
import { useState, useCallback, useEffect } from 'react';

const KEY = 'revive_location';

function readStored() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function useLocation() {
  const [location, setLocation] = useState(readStored);
  const [status, setStatus] = useState('idle');   // idle | prompting | granted | denied | unsupported
  const [error, setError] = useState('');

  useEffect(() => {
    if (location) {
      try { localStorage.setItem(KEY, JSON.stringify(location)); } catch { /* ignore */ }
    }
  }, [location]);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      setError('Geolocation not supported by this browser.');
      return;
    }
    setStatus('prompting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: +pos.coords.latitude.toFixed(6),
          lng: +pos.coords.longitude.toFixed(6),
          source: 'gps',
          at: Date.now(),
        };
        setLocation(loc);
        setStatus('granted');
        setError('');
      },
      (err) => {
        setStatus('denied');
        setError(err.message || 'Location permission denied.');
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  }, []);

  // Manual fallback (pincode/city → approx coords supplied by caller).
  const setManual = useCallback((lat, lng, label = '') => {
    setLocation({ lat: +lat, lng: +lng, source: 'manual', label, at: Date.now() });
    setStatus('granted');
  }, []);

  const clear = useCallback(() => {
    setLocation(null);
    setStatus('idle');
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);

  return { location, status, error, request, setManual, clear };
}

export default useLocation;
