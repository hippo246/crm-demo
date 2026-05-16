/* eslint-disable react-hooks/exhaustive-deps */
// store.js — DEMO VERSION (localStorage, no Firebase)
// Drop-in replacement: same exports, same hook signature as the Firebase version.

import { useState, useEffect, useRef, useCallback } from "react";

// ── localStorage helpers ─────────────────────────────────────────────────────
function lsRead(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return def;
    return JSON.parse(raw);
  } catch {
    return def;
  }
}

function lsWrite(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("localStorage write error:", e.message);
  }
}

// ── Stub: atomicInvoiceSeq ───────────────────────────────────────────────────
// In demo mode there's only one device, so a simple localStorage counter works.
async function atomicInvoiceSeq() {
  const key = "tas9_inv_registry_seq";
  const current = lsRead(key, 0);
  const next = current + 1;
  lsWrite(key, next);
  return next;
}

// ── Sync listeners (kept for API compatibility) ──────────────────────────────
let _lastSyncTs = null;
const _syncListeners = new Set();
function _notifySync() {
  _lastSyncTs = new Date();
  _syncListeners.forEach(fn => fn(_lastSyncTs));
}

// ── useStore ─────────────────────────────────────────────────────────────────
// Signature: useStore(key, defaultValue) → [value, setter, loaded]
// Reads from localStorage on mount; writes back on every set().
// Uses a storage event listener so multiple tabs stay in sync.

function useStore(key, def) {
  const defRef = useRef(def);
  const [val, setRaw] = useState(() => lsRead(key, def));
  const [loaded, setLoaded] = useState(false);

  // Seed localStorage if key is missing, then mark loaded
  useEffect(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) {
      lsWrite(key, defRef.current);
      setRaw(defRef.current);
    } else {
      try {
        let parsed = JSON.parse(stored);
        // Coerce Firebase-style {0:x,1:y} objects back to arrays when default is array
        if (
          Array.isArray(defRef.current) &&
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          parsed = Object.values(parsed);
        }
        setRaw(parsed);
      } catch {
        setRaw(defRef.current);
      }
    }
    setLoaded(true);
    _notifySync();
  }, [key]);

  // Cross-tab sync via storage event
  useEffect(() => {
    function onStorage(e) {
      if (e.key !== key) return;
      try {
        const parsed = e.newValue ? JSON.parse(e.newValue) : defRef.current;
        setRaw(parsed);
        _notifySync();
      } catch {}
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const set = useCallback((next) => {
    setRaw(prev => {
      const n = typeof next === "function" ? next(prev ?? defRef.current) : next;
      lsWrite(key, n);
      _notifySync();
      return n;
    });
  }, [key]);

  return [val, set, loaded];
}

// fbWrite kept for any direct callers (no-op in demo)
function fbWrite(key, data) {
  lsWrite(key, data);
  return Promise.resolve();
}

export { fbWrite, atomicInvoiceSeq, useStore, _syncListeners, _lastSyncTs };
