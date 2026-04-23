"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/auth/loginForm";

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const demoEmail = "manager@example.com";
  const demoPassword = "admin123";

  const getPasswordStatus = () => {
    if (!password) return "";
    return password === demoPassword ? "correct" : "incorrect";
  };

  const passwordStatus = getPasswordStatus();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:5000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      router.push("/dashboard");
    } catch {
      setError("Unable to connect to the server");
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
            passwordStatus={passwordStatus}
            isDemoEmail={email === demoEmail}
            onEmailChange={(e) => setEmail(e.target.value)}
            onPasswordChange={(e) => setPassword(e.target.value)}
            onToggleShowPassword={() => setShowPassword((prev) => !prev)}
            onSubmit={handleLogin}
          />
        </div>
      </section>

      <section className="entry-hero-side">
        <div className="entry-hero-overlay" />

        <div className="entry-hero-content">
          <div className="entry-hero-inner">
            <p className="entry-hero-kicker">AI-powered restaurant analytics</p>
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


