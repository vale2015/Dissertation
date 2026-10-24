"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import useSession from "@/hooks/useSession";
import { hasPermission, PERMISSIONS, ROLES } from "@/lib/permissions";

const PANEL_ID = "rfs-assistant-panel";
const DESTINATIONS = [
  { label: "Weather", detail: "See today's conditions", href: "/dashboard", permission: PERMISSIONS.VIEW_FORECASTS },
  { label: "Local events", detail: "Explore nearby demand drivers", href: "/dashboard/local-events", permission: PERMISSIONS.VIEW_FORECASTS },
  { label: "Reports", detail: "Build a management report", href: "/dashboard/reports", permission: PERMISSIONS.VIEW_REPORTS },
  { label: "Staff", detail: "Manage your team", href: "/dashboard/staff", permission: PERMISSIONS.MANAGE_STAFF_ACCOUNTS },
];

export default function ChatbotShell() {
  const { user } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const launcherRef = useRef(null);
  const closeRef = useRef(null);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    window.requestAnimationFrame(() => launcherRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const controller = new AbortController();
    fetch("/api/chatbot", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error || "Assistant availability could not be checked.");
        if (body?.phase !== "skeleton" || body?.business_tools_enabled !== false) {
          throw new Error("Assistant status is unavailable.");
        }
        setStatus("ready");
      })
      .catch((caught) => {
        if (caught.name === "AbortError") return;
        setError(caught.message);
        setStatus("error");
      });

    return () => controller.abort();
  }, [isOpen, attempt]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, closePanel]);

  if (user?.role !== ROLES.MANAGER) return null;

  const openPanel = () => {
    setStatus("loading");
    setError("");
    setIsOpen(true);
  };

  const retry = () => {
    setStatus("loading");
    setError("");
    setAttempt((value) => value + 1);
  };

  return (
    <div className="chatbot-root">
      <button
        ref={launcherRef}
        className="chatbot-launcher"
        type="button"
        aria-label={isOpen ? "Close RFS assistant" : "Open RFS assistant"}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={PANEL_ID}
        onClick={isOpen ? closePanel : openPanel}
      >
        <span className="chatbot-launcher-mark" aria-hidden="true">✦</span>
        <span>Ask RFS</span>
      </button>

      {isOpen && (
        <section className="chatbot-panel" id={PANEL_ID} role="dialog" aria-modal="false" aria-labelledby="chatbot-title">
          <header className="chatbot-panel-header">
            <div>
              <p className="chatbot-eyebrow">MANAGER ASSISTANT · PREVIEW</p>
              <h2 id="chatbot-title">Ask RFS</h2>
            </div>
            <button ref={closeRef} className="chatbot-close" type="button" aria-label="Close assistant" onClick={closePanel}>×</button>
          </header>

          <div className="chatbot-panel-body" aria-live="polite">
            {status === "loading" && <p className="chatbot-state" role="status">Checking assistant access…</p>}
            {status === "error" && (
              <div className="chatbot-state chatbot-state-error" role="alert">
                <p>{error}</p>
                <button type="button" onClick={retry}>Try again</button>
              </div>
            )}
            {status === "ready" && (
              <>
                <div className="chatbot-welcome">
                  <span className="chatbot-welcome-mark" aria-hidden="true">✦</span>
                  <div>
                    <h3>Your service, in focus.</h3>
                    <p>This is an early preview. Conversations and actions are not enabled yet; your existing dashboard tools still work.</p>
                  </div>
                </div>
                <p className="chatbot-section-label">GO TO A TOOL</p>
                <nav className="chatbot-shortcuts" aria-label="Assistant preview shortcuts">
                  {DESTINATIONS.filter((item) => hasPermission(user, item.permission)).map((item) => (
                    <Link href={item.href} key={item.label} onClick={closePanel}>
                      <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                      <span aria-hidden="true">↗</span>
                    </Link>
                  ))}
                </nav>
              </>
            )}
          </div>

          <div className="chatbot-composer">
            <label htmlFor="chatbot-message">Message</label>
            <div>
              <input id="chatbot-message" type="text" placeholder="Chat is coming soon" disabled />
              <button type="button" disabled>Send</button>
            </div>
            <p>Nothing you type is sent to an AI model in this preview.</p>
          </div>
        </section>
      )}
    </div>
  );
}
