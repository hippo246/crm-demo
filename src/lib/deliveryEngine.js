/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
// deliveryEngine.js — DEMO VERSION (localStorage, no Firebase)
// Drop-in replacement: same exports and function signatures as the Firebase version.

import { useEffect, useState } from "react";

// ── Storage key ──────────────────────────────────────────────────────────────
const EVENTS_KEY = "tas9_deliv_events";

// ── Helpers ──────────────────────────────────────────────────────────────────
function ts() { return new Date().toISOString(); }

function readAllEvents() {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeAllEvents(all) {
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(all)); } catch {}
}

function parseEvents(eventsObj) {
  if (!eventsObj || typeof eventsObj !== "object" || Array.isArray(eventsObj)) return [];
  return Object.values(eventsObj)
    .filter(ev => ev && typeof ev === "object" && ev.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// ── Core event log ───────────────────────────────────────────────────────────

/** Write one audit event for a delivery (fire-and-forget) */
export async function logDeliveryEvent(deliveryId, event) {
  if (!deliveryId) return;
  try {
    const all = readAllEvents();
    if (!all[deliveryId]) all[deliveryId] = {};
    const id = `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    all[deliveryId][id] = { ...event, deliveryId, timestamp: ts() };
    writeAllEvents(all);
    // Notify same-tab listeners
    window.dispatchEvent(new CustomEvent("deliveryEventsUpdated", { detail: { deliveryId } }));
  } catch (err) {
    console.warn("[deliveryEngine] logDeliveryEvent failed:", err);
  }
}

/** Fetch all audit events for a delivery (one-time read) */
export async function getDeliveryEvents(deliveryId) {
  if (!deliveryId) return [];
  try {
    const all = readAllEvents();
    return parseEvents(all[deliveryId] || {});
  } catch (err) {
    console.warn("[deliveryEngine] getDeliveryEvents failed:", err);
    return [];
  }
}

/** React hook — live audit events for a delivery (updates on any write) */
export function useDeliveryEvents(deliveryId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    try {
      const all = readAllEvents();
      setEvents(parseEvents(all[deliveryId] || {}));
    } catch {
      setEvents([]);
    }
    setLoading(false);
  }
  useEffect(() => {
    if (!deliveryId) { setEvents([]); setLoading(false); return; }
    refresh();

    // Listen for writes in this tab
    function onUpdate(e) {
      if (e.detail?.deliveryId === deliveryId) refresh();
    }
    // Listen for writes from other tabs
    function onStorage(e) {
      if (e.key === EVENTS_KEY) refresh();
    }

    window.addEventListener("deliveryEventsUpdated", onUpdate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("deliveryEventsUpdated", onUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, [deliveryId]);

  return { events, loading };
}

// ── Status machine ────────────────────────────────────────────────────────────
const STATUS_FLOW = ["Pending", "In Transit", "Delivered"];

function nextStatus(current) {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx < 0 || idx >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

// ── Core actions ──────────────────────────────────────────────────────────────

export async function dispatchDelivery(delivery, actor, setDeliv, notify) {
  if (!delivery?.id) return;
  if (delivery.status !== "Pending") {
    notify?.(`Cannot dispatch — status is ${delivery.status}`, "warning");
    return;
  }
  const updatedAt = ts();
  const update = {
    status: "In Transit",
    dispatchedAt: updatedAt,
    dispatchedBy: actor?.name || "Unknown",
    dispatchedByRole: actor?.role || "staff",
    updatedAt,
  };
  setDeliv(prev =>
    (Array.isArray(prev) ? prev : []).map(d =>
      d.id === delivery.id ? { ...d, ...update } : d
    )
  );
  notify?.(`🚚 ${delivery.customer} dispatched`, "success");
  await logDeliveryEvent(delivery.id, {
    action: "dispatched",
    fromStatus: "Pending",
    toStatus: "In Transit",
    actorName: actor?.name || "Unknown",
    actorRole: actor?.role || "staff",
    actorUid: actor?.uid || null,
    note: `Dispatched by ${actor?.name || "Unknown"}`,
  });
}

export async function advanceDeliveryStatus(delivery, actor, setDeliv, notify) {
  if (!delivery?.id) return;
  const next = nextStatus(delivery.status);
  if (!next) { notify?.("Delivery already at final status", "info"); return; }
  const updatedAt = ts();
  const update = {
    status: next,
    updatedAt,
    ...(next === "In Transit" && {
      dispatchedAt: updatedAt,
      dispatchedBy: actor?.name || "Unknown",
      dispatchedByRole: actor?.role || "staff",
    }),
    ...(next === "Delivered" && {
      deliveredAt: updatedAt,
      deliveredBy: actor?.name || "Unknown",
      deliveredByRole: actor?.role || "staff",
    }),
  };
  setDeliv(prev =>
    (Array.isArray(prev) ? prev : []).map(d =>
      d.id === delivery.id ? { ...d, ...update } : d
    )
  );
  notify?.(`${delivery.customer} → ${next}`, "info");
  await logDeliveryEvent(delivery.id, {
    action: next === "In Transit" ? "dispatched" : "delivered",
    fromStatus: delivery.status,
    toStatus: next,
    actorName: actor?.name || "Unknown",
    actorRole: actor?.role || "staff",
    actorUid: actor?.uid || null,
    note: `Status advanced to ${next} by ${actor?.name || "Unknown"}`,
  });
}

export async function cancelDelivery(delivery, actor, setDeliv, notify, reason = "") {
  if (!delivery?.id) return;
  if (delivery.status === "Delivered" || delivery.status === "Cancelled") {
    notify?.("Cannot cancel a completed or already-cancelled delivery", "warning");
    return;
  }
  const updatedAt = ts();
  const update = {
    status: "Cancelled",
    cancelledAt: updatedAt,
    cancelledBy: actor?.name || "Unknown",
    cancelledByRole: actor?.role || "staff",
    cancelReason: reason || "",
    updatedAt,
  };
  setDeliv(prev =>
    (Array.isArray(prev) ? prev : []).map(d =>
      d.id === delivery.id ? { ...d, ...update } : d
    )
  );
  notify?.(`${delivery.customer} cancelled`, "error");
  await logDeliveryEvent(delivery.id, {
    action: "cancelled",
    fromStatus: delivery.status,
    toStatus: "Cancelled",
    actorName: actor?.name || "Unknown",
    actorRole: actor?.role || "staff",
    actorUid: actor?.uid || null,
    note: reason ? `Cancelled: ${reason}` : `Cancelled by ${actor?.name || "Unknown"}`,
  });
}

export async function addDeliveryNote(deliveryId, actor, note) {
  await logDeliveryEvent(deliveryId, {
    action: "note",
    actorName: actor?.name || "Unknown",
    actorRole: actor?.role || "staff",
    actorUid: actor?.uid || null,
    note,
  });
}
