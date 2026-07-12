"use client";

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
        <h1 className="login-title">Welcome Back</h1>

        <p className="login-subtitle">
          Sign in to access demand forecasts and operational insights.
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
          <p className="login-error" role="alert">
            {error}
          </p>
        )}

        <button className="login-button" type="submit" disabled={loading}>
          {loading ? "LOGGING IN..." : "LOGIN"}
        </button>
      </form>

      <div className="demo-box">
        <h2 className="demo-box-title">RECRUITER DEMO ACCESS</h2>

        <p className="demo-box-text">
          <strong>Email:</strong> manager@example.com
        </p>

        <p className="demo-box-text">
          <strong>Password:</strong> admin123
        </p>

        <p className="demo-box-text">
          This account provides access to demonstration data only.
        </p>
      </div>
    </div>
  );
}