"use client";

import Image from "next/image";

// Reusable login form component used by the home/login page.
export default function LoginForm({
  email,
  password,
  error,
  loading,
  showPassword,
  onEmailChange,
  onPasswordChange,
  onToggleShowPassword,
  onSubmit,
}) {
  return (
    <div className="login-panel">
      <div className="login-panel-header">
        <p className="login-eyebrow">Welcome to RFS</p>
        <div className="login-heading-row">
          <h1 className="login-title">Welcome back</h1>
          <Image
            src="/brand/rfs-ai-mascot-v2.png"
            alt=""
            width={72}
            height={72}
            className="login-mascot"
            priority
          />
        </div>

        <p className="login-subtitle">
          Sign in to plan your next service with confidence.
        </p>
      </div>

      <form className="login-form" onSubmit={onSubmit}>
        <div className="login-field">
          <label className="login-label" htmlFor="login-email">
            Email
          </label>

          <input
            id="login-email"
            name="email"
            className="login-input"
            type="email"
            value={email}
            onChange={onEmailChange}
            placeholder="Enter your email"
            autoComplete="email"
            aria-describedby={error ? "login-error" : undefined}
            disabled={loading}
            required
          />
        </div>

        <div className="login-field">
          <label className="login-label" htmlFor="login-password">
            Password
          </label>

          <div className="login-password-wrap">
            <input
              id="login-password"
              name="password"
              className="login-input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={onPasswordChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              aria-describedby={error ? "login-error" : undefined}
              disabled={loading}
              required
            />

            <button
              type="button"
              className="login-password-toggle"
              onClick={onToggleShowPassword}
              disabled={loading}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {error && (
          <p className="login-error" id="login-error" role="alert">
            {error}
          </p>
        )}

        <button className="login-button" type="submit" disabled={loading}>
          <span>{loading ? "Signing in…" : "Sign in"}</span>
          {!loading && <span aria-hidden="true">→</span>}
        </button>
      </form>

      <details className="demo-box">
        <summary className="demo-box-title">Exploring the demo? <span aria-hidden="true">⌄</span></summary>
        <div className="demo-box-content">
          <p className="demo-box-text">Use the demonstration account to explore sample data.</p>

          <p className="demo-box-text">
            <strong>Email:</strong> manager@example.com
          </p>

          <p className="demo-box-text">
            <strong>Password:</strong> admin123
          </p>

          <p className="demo-box-text">This account provides access to demonstration data only.</p>
        </div>
      </details>
    </div>
  );
}
