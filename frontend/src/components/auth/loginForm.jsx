"use client";

export default function LoginForm({
  email,
  password,
  error,
  loading,
  showPassword,
  passwordStatus,
  isDemoEmail,
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
          <label className="login-label">Email</label>
          <input
            className="login-input"
            type="email"
            value={email}
            onChange={onEmailChange}
            placeholder="Enter your email"
            required
          />
        </div>

        <div className="login-field">
          <label className="login-label">Password</label>

          <div className="login-password-wrap">
            <input
              className={`login-input ${
                passwordStatus === "correct" && isDemoEmail
                  ? "login-input-correct"
                  : passwordStatus === "incorrect" && password
                  ? "login-input-incorrect"
                  : ""
              }`}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={onPasswordChange}
              placeholder="Enter your password"
              required
            />

            <button
              type="button"
              className="login-password-toggle"
              onClick={onToggleShowPassword}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {password && isDemoEmail && passwordStatus === "correct" && (
            <p className="login-success">Password is correct</p>
          )}

          {password && passwordStatus === "incorrect" && (
            <p className="login-error-inline">Password is incorrect</p>
          )}
        </div>

        {error && <p className="login-error">{error}</p>}

        <button className="login-button" type="submit" disabled={loading}>
          {loading ? "LOGGING IN..." : "LOGIN"}
        </button>
      </form>

      <div className="demo-box">
        <h2 className="demo-box-title">DEMO ACCESS</h2>
        <p className="demo-box-text">
          <strong>Email:</strong> manager@example.com
        </p>
        <p className="demo-box-text">
          <strong>Password:</strong> admin123
        </p>
      </div>
    </div>
  );
}