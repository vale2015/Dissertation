"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/auth/loginForm";

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

      router.replace("/dashboard");
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
      <section className="entry-login-side">
        <div className="entry-login-wrap">
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
            onToggleShowPassword={() => {
              setShowPassword((currentValue) => !currentValue);
            }}
            onSubmit={handleLogin}
          />
        </div>
      </section>

      <section className="entry-hero-side">
        <div className="entry-hero-overlay" />

        <div className="entry-hero-content">
          <div className="entry-hero-inner">
            <p className="entry-hero-kicker">
              AI-powered restaurant analytics
            </p>

            <h1 className="entry-hero-title">
              <span className="entry-hero-title-mark">RFS</span>
              <br />
              Restaurant Forecasting System
            </h1>

            <p className="entry-hero-text">
              Machine-learning insights for restaurant demand forecasting,
              booking analysis, and staff planning.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}


