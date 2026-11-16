"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/auth/loginForm";
import "./login-redesign.css";

// Main login page shown when the application first opens.
export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Send the login details to the same-origin Next.js authentication route.
  const handleLogin = async (event) => {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error || "Login failed.");
        return;
      }

      // The JWT is now stored in an HttpOnly cookie by the server.
      // Nothing is saved in localStorage.
      setPassword("");

      router.replace(data?.user?.role === "staff" ? "/dashboard/profile" : "/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Login request failed:", error);
      setError("Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="entry-page">
      <div className="entry-shell">
        <section className="entry-login-side" aria-label="Sign in to RFS">
          <div className="entry-login-wrap">
            <div className="entry-brand" aria-label="RFS Restaurant Forecasting System">
              <span className="entry-brand-mark" aria-hidden="true">RFS</span>
              <span className="entry-brand-name">Restaurant<br />Forecasting<br />System</span>
            </div>
            <LoginForm
              email={email}
              password={password}
              error={error}
              loading={loading}
              showPassword={showPassword}
              onEmailChange={(event) => {
                setEmail(event.target.value);
                setError("");
              }}
              onPasswordChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              onToggleShowPassword={() => setShowPassword((currentValue) => !currentValue)}
              onSubmit={handleLogin}
            />
          </div>
        </section>

        <section className="entry-hero-side" aria-labelledby="entry-hero-title">
          <div className="entry-hero-content">
            <p className="entry-hero-kicker">Restaurant intelligence, made practical</p>
            <h2 className="entry-hero-title" id="entry-hero-title">Make every service<br /><span>more predictable.</span></h2>
            <p className="entry-hero-text">Bring demand forecasts, staffing recommendations and management reports into one clear view.</p>
            <div className="entry-hero-graphic" aria-hidden="true">
              <div className="entry-graphic-header"><span className="entry-graphic-dot" /> <span>Planning overview</span><span className="entry-graphic-dashes">•••</span></div>
              <svg viewBox="0 0 520 190" preserveAspectRatio="none" focusable="false">
                <path className="entry-graphic-grid" d="M0 40H520M0 95H520M0 150H520" />
                <path className="entry-graphic-area" d="M0 143C55 132 74 104 122 119S199 143 248 91S326 114 376 74S453 85 520 38V190H0Z" />
                <path className="entry-graphic-line" d="M0 143C55 132 74 104 122 119S199 143 248 91S326 114 376 74S453 85 520 38" />
                <circle cx="520" cy="38" r="6" className="entry-graphic-point" />
              </svg>
              <div className="entry-graphic-footer"><span>Demand</span><span>Staffing</span><span>Reports</span></div>
            </div>
            <p className="entry-hero-note">Built for the decisions behind a better service.</p>
          </div>
        </section>
      </div>
    </main>
  );
}


