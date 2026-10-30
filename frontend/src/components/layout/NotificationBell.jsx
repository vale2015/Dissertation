"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INBOX_URL = "/api/backend/notifications/";

export default function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const requestVersion = useRef(0);

  const refresh = useCallback(async (signal) => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(INBOX_URL, { cache: "no-store", signal });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body?.notifications) || !Number.isInteger(body?.unread_count)) {
        throw new Error(body?.error?.message || "Notifications could not be loaded.");
      }
      if (version !== requestVersion.current) return;
      setItems(body.notifications);
      setUnreadCount(body.unread_count);
    } catch (caught) {
      if (version === requestVersion.current && caught.name !== "AbortError") setError(caught.message || "Notifications could not be loaded.");
    } finally {
      if (version === requestVersion.current && !signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    refresh(controller.signal);
    const onFocus = () => refresh(controller.signal);
    window.addEventListener("focus", onFocus);
    return () => { controller.abort(); window.removeEventListener("focus", onFocus); };
  }, [userId, refresh]);

  useEffect(() => {
    if (!open) return undefined;
    refresh();
    const onKeyDown = (event) => {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => { document.removeEventListener("keydown", onKeyDown); document.removeEventListener("pointerdown", onPointerDown); };
  }, [open, refresh]);

  async function markRead(id) {
    setBusyId(id);
    setError("");
    try {
      const response = await fetch(`${INBOX_URL}${id}/read`, { method: "PATCH", headers: { Accept: "application/json" }, cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.notification?.read_at) throw new Error(body?.error?.message || "Notification could not be updated.");
      requestVersion.current += 1;
      setLoading(false);
      setItems((current) => current.map((item) => item.id === id ? { ...item, read_at: body.notification.read_at } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (caught) {
      setError(caught.message || "Notification could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  if (!userId) return null;
  return <div className="notification-root" ref={rootRef}>
    <button ref={buttonRef} type="button" className="notification-bell" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`} aria-expanded={open} aria-controls="rfs-notification-inbox" onClick={() => setOpen((value) => !value)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4" /></svg>
      {unreadCount > 0 && <span className="notification-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </button>
    {open && <section className="notification-inbox" id="rfs-notification-inbox" aria-label="Notifications">
      <div className="notification-inbox-header"><h2>Notifications</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications">×</button></div>
      {loading && <p className="notification-state" role="status">Loading notifications…</p>}
      {error && <div className="notification-state" role="alert"><p>{error}</p><button type="button" onClick={() => refresh()}>Retry</button></div>}
      {!loading && !error && items.length === 0 && <p className="notification-state">No notifications yet. Saved reports will appear here.</p>}
      {!loading && items.length > 0 && <ul className="notification-list">
        {items.map((item) => <li key={item.id} className={item.read_at ? "is-read" : "is-unread"}>
          <strong>{item.title}</strong>
          <p>{item.body}</p>
          <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>
          {!item.read_at && <button type="button" disabled={busyId === item.id} onClick={() => markRead(item.id)}>{busyId === item.id ? "Updating…" : "Mark as read"}</button>}
        </li>)}
      </ul>}
    </section>}
  </div>;
}
