/* eslint-disable react-hooks/exhaustive-deps, no-unused-vars */
// SecurityPanels.js — DEMO VERSION (no Firebase)
// PasskeyManager: localStorage only (no Firebase write)
// SecuritySessions: shows current session only (no live DB)
// FailedLoginAttempts: reads from localStorage

import React, { useState, useEffect } from "react";
import { T } from "../lib/theme";
import { useStore } from "../lib/store";
import { SESSION_TTL, DEVICE_ID } from "../lib/auth";
/* global PublicKeyCredential */
import { ts, uid } from "../lib/utils";
import { hashPw, checkPw, getDeviceInfo } from "../lib/auth";
import { Btn, Inp, Card, Hr, Sheet, Tog, Pill } from "./ui";

// ── PasskeyManager ────────────────────────────────────────────
function PasskeyManager({ dm, t, sess, notify, ask, addLog }) {
  const storedPk = (() => { try { return JSON.parse(localStorage.getItem("__crm_pk__") || "null"); } catch { return null; } })();
  const [pkStatus, setPkStatus] = useState(storedPk ? "registered" : "none");

  async function registerPasskey() {
    if (!window.PublicKeyCredential) { notify("Passkeys not supported on this browser/device"); return; }
    try {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false);
      if (!available) { notify("No biometric authenticator found on this device"); return; }
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const cred = await navigator.credentials.create({ publicKey: { challenge, rp: { name: "TAS Healthy World CRM", id: window.location.hostname }, user: { id: new TextEncoder().encode(sess.id || "user"), name: sess.username || "user", displayName: sess.name || "User" }, pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }], authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", requireResidentKey: false }, timeout: 60000 } });
      if (cred) {
        const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        localStorage.setItem("__crm_pk__", JSON.stringify({ credId, userId: sess.id, registeredAt: Date.now() }));
        setPkStatus("registered");
        addLog("Passkey registered", "Biometric login enabled for this device");
        notify("✓ Passkey registered! You can now use Face ID / fingerprint to sign in.");
      }
    } catch (e) {
      if (e.name === "NotAllowedError") notify("Biometric setup was cancelled.");
      else notify("Error: " + e.message);
    }
  }

  function removePasskey() {
    ask("Remove passkey from this device? You will need to use password login.", () => {
      localStorage.removeItem("__crm_pk__");
      setPkStatus("none");
      addLog("Passkey removed", "Biometric login disabled for this device");
      notify("Passkey removed");
    });
  }

  return (
    <div>
      <div style={{ background: pkStatus === "registered" ? "#10b98110" : "#3b82f610", border: `1.5px solid ${pkStatus === "registered" ? "#10b98130" : "#3b82f630"}`, borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 24 }}>{pkStatus === "registered" ? "✅" : "🔑"}</span>
        <div style={{ flex: 1 }}>
          <p style={{ color: pkStatus === "registered" ? "#10b981" : "#3b82f6", fontWeight: 700, fontSize: 13 }}>{pkStatus === "registered" ? "Passkey registered on this device" : "No passkey on this device"}</p>
          <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>{pkStatus === "registered" ? "You can sign in with Face ID, fingerprint, or Windows Hello" : "Register a passkey to enable biometric login"}</p>
        </div>
      </div>
      {pkStatus === "registered"
        ? <div style={{ display: "flex", gap: 8 }}>
            <button onClick={registerPasskey} style={{ flex: 1, background: t.inp, border: `1.5px solid ${t.border}`, color: t.text, borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔄 Re-register</button>
            <button onClick={removePasskey} style={{ flex: 1, background: "#ef444415", border: "1.5px solid #ef444430", color: "#ef4444", borderRadius: 10, padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🗑 Remove</button>
          </div>
        : <button onClick={registerPasskey} style={{ width: "100%", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 10V2" /><path d="M8 6l4-4 4 4" /><rect x="2" y="12" width="20" height="10" rx="2" /></svg>
            Register Passkey for This Device
          </button>}
    </div>
  );
}

// ── SecuritySessions — demo: shows current session only ───────
function SecuritySessions({ dm, t, ask, addLog, notify }) {
  const dev = getDeviceInfo();
  const deviceIcon = (d) => d === "Mobile" ? "📱" : d === "Tablet" ? "📟" : "💻";
  const browserIcon = (b) => b === "Chrome" ? "🟡" : b === "Firefox" ? "🦊" : b === "Safari" ? "🧭" : b === "Edge" ? "🔵" : "🌐";
  const osIcon = (o) => o === "Android" ? "🤖" : o === "iOS" || o === "iPadOS" ? "🍎" : o === "Windows" ? "🪟" : o === "macOS" ? "🍎" : o === "Linux" ? "🐧" : "💻";

  return (
    <Card dm={dm}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>🛡️ Active Sessions</p>
            <p style={{ color: t.sub, fontSize: 11, marginTop: 2 }}>1 device currently logged in</p>
          </div>
        </div>
        <div style={{ background: dm ? "rgba(16,185,129,0.08)" : "rgba(16,185,129,0.05)", border: "1.5px solid #10b98140", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ fontSize: 32, lineHeight: 1, marginTop: 2 }}>{deviceIcon(dev.deviceType)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                <span style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>This Device</span>
                <span style={{ background: "#10b98120", color: "#10b981", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 99 }}>● THIS DEVICE</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginBottom: 3 }}>
                <span style={{ color: t.sub, fontSize: 11 }}>{browserIcon(dev.browser)} {dev.browser}</span>
                <span style={{ color: t.sub, fontSize: 11 }}>{osIcon(dev.os)} {dev.os} · {dev.deviceType}</span>
                <span style={{ color: t.sub, fontSize: 11 }}>🖥 {dev.screenRes}</span>
              </div>
              <p style={{ color: t.sub, fontSize: 10, marginTop: 4, fontStyle: "italic" }}>
                Live session tracking is disabled in demo mode.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── FailedLoginAttempts — reads from localStorage ─────────────
function FailedLoginAttempts({ dm, t, ask, notify }) {
  const [failedLogins, setFailedLogins] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("tas_failed_logins");
      if (raw) {
        const list = Object.values(JSON.parse(raw)).sort((a, b) => (b.loginAt || 0) - (a.loginAt || 0)).slice(0, 50);
        setFailedLogins(list);
      }
    } catch {}
  }, []);

  if (failedLogins.length === 0) return null;

  return (
    <Card dm={dm}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p style={{ color: "#ef4444", fontWeight: 700, fontSize: 14 }}>⚠️ Failed Login Attempts</p>
            <p style={{ color: t.sub, fontSize: 11, marginTop: 1 }}>{failedLogins.length} failed attempt{failedLogins.length !== 1 ? "s" : ""} recorded</p>
          </div>
          <button onClick={() => ask("Clear all failed login records?", () => { localStorage.removeItem("tas_failed_logins"); setFailedLogins([]); notify("Cleared ✓"); })}
            style={{ color: "#ef4444", fontSize: 11, fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
        </div>
        {failedLogins.slice(0, 20).map((l, i) => (
          <div key={i} style={{ borderBottom: `1px solid ${t.border}`, padding: "7px 0" }} className="last:border-0">
            <div className="flex items-center justify-between gap-2">
              <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>@{l.username || "(unknown)"}</span>
              <span style={{ color: t.sub, fontSize: 10 }}>{l.ts}</span>
            </div>
            <div className="flex gap-x-3 flex-wrap mt-0.5">
              {l.browser && <span style={{ color: t.sub, fontSize: 9 }}>🌐 {l.browser}</span>}
              {l.os && <span style={{ color: t.sub, fontSize: 9 }}>💻 {l.os}</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export { PasskeyManager, SecuritySessions, FailedLoginAttempts };
