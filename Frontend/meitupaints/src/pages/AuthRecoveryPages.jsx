import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client.js";
import NavBar from "../components/NavBar.jsx";

// Same visual family as UserLogin.jsx (the "apple-login-*" redesigned sibling)
// - reusing its exact tokens/classes under an "apple-recovery-*" prefix
// (fog canvas, plain white/thin-border input card, clamp(34px,6vw,48px)
// weight-700 headline, 58px flat input rows, circular icon buttons, #0066cc
// links) so every recovery-flow screen (forgot password, resend setup link,
// reset password, set password) finally matches the rest of the redesigned
// auth flow instead of the old glassmorphic/gradient-blob look.

const neutralMessage =
  "If an eligible account exists for this email, an email has been sent.";

function EyeIcon({ hidden = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
      {hidden ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function StatusAlert({ tone = "error", children }) {
  const toneClass = tone === "success" ? "success" : tone === "notice" ? "notice" : "error";
  return (
    <div className={`apple-recovery-alert ${toneClass}`} role={toneClass === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

function PasswordInput({ label, value, onChange, visible, onToggleVisibility, placeholder, autoComplete }) {
  return (
    <div className="apple-recovery-field password">
      <label>{label}</label>
      <div className="apple-recovery-password-row">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="apple-recovery-quiet-button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={onToggleVisibility}
        >
          <EyeIcon hidden={visible} />
        </button>
      </div>
    </div>
  );
}

function RecoveryShell({ eyebrow, title, description, children }) {
  return (
    <>
      <NavBar />
      <main className="apple-recovery-page">
        <Link to="/" className="apple-recovery-logo" aria-label="Back to home">
          <img src="/meitulogo.svg" alt="Meitu Paints" />
        </Link>

        <section className="apple-recovery-card" aria-labelledby="recovery-title">
          <div className="apple-recovery-kicker">{eyebrow}</div>
          <h1 id="recovery-title">{title}</h1>
          <p className="apple-recovery-subtitle">{description}</p>

          {children}
        </section>

        <style>{`
        .apple-recovery-page{
          min-height:calc(100vh - 44px);
          padding:72px 20px 34px;
          display:flex;
          flex-direction:column;
          align-items:center;
          justify-content:center;
          background:#f5f5f7;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
        }

        .apple-recovery-logo{
          width:56px;
          height:56px;
          margin-bottom:30px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          text-decoration:none;
        }

        .apple-recovery-logo img{
          width:52px;
          height:52px;
          object-fit:contain;
          display:block;
        }

        .apple-recovery-card{
          width:min(100%, 480px);
          text-align:center;
        }

        .apple-recovery-kicker{
          color:#707070;
          font-size:14px;
          line-height:1.3;
          font-weight:600;
          letter-spacing:-.003em;
        }

        .apple-recovery-card h1{
          margin:8px 0 0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
          font-size:clamp(34px, 6vw, 48px);
          line-height:1.08;
          font-weight:700;
          letter-spacing:-.022em;
        }

        .apple-recovery-subtitle{
          width:min(100%, 380px);
          margin:12px auto 0;
          color:#707070;
          font-size:17px;
          line-height:1.45;
          font-weight:400;
          letter-spacing:-.006em;
        }

        .apple-recovery-form{
          margin-top:30px;
          display:grid;
          gap:16px;
        }

        .apple-recovery-input-card{
          overflow:hidden;
          border-radius:18px;
          background:#fff;
          border:1px solid #d2d2d7;
          text-align:left;
          transition:border-color .16s ease, background-color .16s ease;
        }

        .apple-recovery-input-card:focus-within{
          border-color:#86868b;
        }

        .apple-recovery-field{
          display:grid;
          grid-template-columns:92px minmax(0, 1fr);
          align-items:center;
          min-height:58px;
          padding:0 10px 0 16px;
        }

        .apple-recovery-field + .apple-recovery-field{
          border-top:1px solid #e8e8ed;
        }

        .apple-recovery-field label{
          color:#707070;
          font-size:13px;
          line-height:1;
          font-weight:400;
          letter-spacing:-.003em;
        }

        .apple-recovery-field:focus-within label{
          color:#1d1d1f;
        }

        .apple-recovery-field input{
          width:100%;
          height:58px;
          border:0 !important;
          border-radius:0 !important;
          background:#fff !important;
          background-color:#fff !important;
          background-image:none !important;
          color:#1d1d1f;
          outline:0;
          box-shadow:none !important;
          appearance:none;
          -webkit-appearance:none;
          -webkit-tap-highlight-color:transparent;
          font-size:17px;
          line-height:1.3;
          font-weight:400;
          letter-spacing:-.006em;
          padding:0 !important;
        }

        .apple-recovery-field input:focus,
        .apple-recovery-field input:focus-visible{
          background:#fff !important;
          border:0 !important;
          outline:0 !important;
          box-shadow:none !important;
        }

        .apple-recovery-field input:autofill,
        .apple-recovery-field input:-webkit-autofill,
        .apple-recovery-field input:-webkit-autofill:hover,
        .apple-recovery-field input:-webkit-autofill:focus{
          background:#fff !important;
          background-color:#fff !important;
          -webkit-text-fill-color:#1d1d1f !important;
          caret-color:#1d1d1f !important;
          box-shadow:0 0 0 1000px #fff inset !important;
          -webkit-box-shadow:0 0 0 1000px #fff inset !important;
          transition:background-color 9999s ease-in-out 0s !important;
        }

        .apple-recovery-field input::placeholder{
          color:#86868b;
        }

        .apple-recovery-password-row{
          display:grid;
          grid-template-columns:minmax(0, 1fr) 36px;
          align-items:center;
          gap:6px;
        }

        .apple-recovery-single-row{
          display:grid;
          grid-template-columns:minmax(0, 1fr) 36px;
          align-items:center;
          gap:6px;
        }

        .apple-recovery-quiet-button,
        .apple-recovery-icon-submit{
          width:34px;
          height:34px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:0;
          cursor:pointer;
          transition:background-color .1s ease, color .1s ease, opacity .1s ease;
        }

        .apple-recovery-quiet-button{
          border:0;
          background:transparent;
          color:#707070;
        }

        .apple-recovery-quiet-button:hover{
          background:#f5f5f7;
          color:#1d1d1f;
        }

        .apple-recovery-icon-submit{
          border:1px solid #86868b;
          background:#fff;
          color:#1d1d1f;
        }

        .apple-recovery-icon-submit:hover:not(:disabled){
          background:#1d1d1f;
          border-color:#1d1d1f;
          color:#fff;
        }

        .apple-recovery-icon-submit:disabled{
          cursor:not-allowed;
          opacity:.48;
        }

        .apple-recovery-primary-button{
          height:56px;
          border-radius:999px;
          border:1px solid #1d1d1f;
          background:#1d1d1f;
          color:#fff;
          font-size:15px;
          font-weight:600;
          letter-spacing:-.006em;
          cursor:pointer;
          transition:transform .12s var(--ease-out, cubic-bezier(.23,1,.32,1)), background-color .14s ease, opacity .14s ease;
        }

        .apple-recovery-primary-button:hover:not(:disabled){
          background:#000;
        }

        .apple-recovery-primary-button:active:not(:disabled){
          transform:scale(.98);
        }

        .apple-recovery-primary-button:disabled{
          cursor:not-allowed;
          opacity:.4;
        }

        .apple-recovery-alert{
          margin-top:20px;
          width:100%;
          border-radius:14px;
          padding:12px 14px;
          text-align:left;
          font-size:13px;
          line-height:1.45;
          font-weight:500;
        }

        .apple-recovery-form .apple-recovery-alert{
          margin-top:0;
        }

        .apple-recovery-alert.error{
          background:rgba(182,68,0,.08);
          border:1px solid rgba(182,68,0,.18);
          color:#b64400;
        }

        .apple-recovery-alert.success{
          background:rgba(18,183,106,.08);
          border:1px solid rgba(18,183,106,.18);
          color:#067647;
        }

        .apple-recovery-alert.notice{
          background:#fff;
          border:1px solid #e8e8ed;
          color:#474747;
        }

        .apple-recovery-links{
          margin-top:6px;
          display:flex;
          justify-content:space-between;
          gap:12px;
          flex-wrap:wrap;
          font-size:13px;
          line-height:1.35;
        }

        .apple-recovery-links.centered{
          justify-content:center;
        }

        .apple-recovery-links a{
          color:#0066cc;
          text-decoration:none;
        }

        .apple-recovery-links a:hover{
          text-decoration:underline;
        }

        .apple-recovery-hint{
          margin-top:4px;
          border-radius:14px;
          padding:12px 14px;
          background:#fff;
          border:1px solid #e8e8ed;
          color:#707070;
          text-align:left;
          font-size:13px;
          line-height:1.5;
        }

        @media (max-width:560px){
          .apple-recovery-page{
            justify-content:flex-start;
            padding-top:64px;
          }

          .apple-recovery-logo{
            margin-bottom:24px;
          }

          .apple-recovery-field{
            grid-template-columns:1fr;
            align-items:start;
            gap:4px;
            padding:10px 12px 8px;
          }

          .apple-recovery-field input{
            height:38px;
          }
        }
      `}</style>
      </main>
    </>
  );
}

function RequestEmailPage({ mode, eyebrow, title, description, endpoint, submitLabel, footerLink }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ loading: false, ok: false, err: "" });

  const onSubmit = async (event) => {
    event.preventDefault();
    setState({ loading: true, ok: false, err: "" });

    try {
      await api.post(endpoint, { email });
      setState({ loading: false, ok: true, err: "" });
    } catch (error) {
      setState({
        loading: false,
        ok: false,
        err: getApiErrorMessage(error, "Unable to process this request."),
      });
    }
  };

  return (
    <RecoveryShell eyebrow={eyebrow} title={title} description={description}>
      <form className="apple-recovery-form" onSubmit={onSubmit}>
        {state.ok ? <StatusAlert tone="success">{neutralMessage}</StatusAlert> : null}
        {state.err ? <StatusAlert>{state.err}</StatusAlert> : null}

        <div className="apple-recovery-input-card">
          <div className="apple-recovery-field">
            <label htmlFor="recovery-email">Email</label>
            <div className="apple-recovery-single-row">
              <input
                id="recovery-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
              <button
                type="submit"
                className="apple-recovery-icon-submit"
                disabled={state.loading}
                aria-label={submitLabel}
              >
                {state.loading ? "…" : <ArrowRightIcon />}
              </button>
            </div>
          </div>
        </div>

        <div className="apple-recovery-links">
          <Link to="/login">Back to login</Link>
          <Link to={footerLink.to}>{footerLink.label}</Link>
        </div>

        {mode === "setup" ? (
          <div className="apple-recovery-hint">
            Setup links are available only for approved dealer or dispatcher accounts that have not completed
            password setup yet.
          </div>
        ) : null}
      </form>
    </RecoveryShell>
  );
}

function SetNewPasswordPage({ purpose, endpoint, title, description, expiredLink, successRedirect = "/login" }) {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [tokenState, setTokenState] = useState({ loading: true, valid: false, reason: "" });
  const [state, setState] = useState({ loading: false, ok: false, err: "" });

  useEffect(() => {
    let cancelled = false;

    async function checkToken() {
      if (!token) {
        setTokenState({ loading: false, valid: false, reason: "MISSING" });
        return;
      }

      try {
        const { data } = await api.post("/api/auth/password-token-status", { token, purpose });

        if (!cancelled) {
          setTokenState({
            loading: false,
            valid: Boolean(data?.valid),
            reason: data?.reason || "",
          });
        }
      } catch {
        if (!cancelled) {
          setTokenState({ loading: false, valid: false, reason: "INVALID" });
        }
      }
    }

    checkToken();
    return () => {
      cancelled = true;
    };
  }, [purpose, token]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setState({ loading: true, ok: false, err: "" });

    if (!token) {
      setState({ loading: false, ok: false, err: "Missing token in URL." });
      return;
    }

    if (pw.length < 8) {
      setState({ loading: false, ok: false, err: "Password must be at least 8 characters." });
      return;
    }

    if (pw !== pw2) {
      setState({ loading: false, ok: false, err: "Passwords do not match." });
      return;
    }

    try {
      await api.post(endpoint, { token, newPassword: pw });
      setState({ loading: false, ok: true, err: "" });
      setTimeout(() => nav(successRedirect), 700);
    } catch (error) {
      setState({
        loading: false,
        ok: false,
        err: getApiErrorMessage(error, "Unable to save password."),
      });
    }
  };

  const showInvalidLink = !tokenState.loading && !tokenState.valid;
  const submitDisabled = state.loading || tokenState.loading || !tokenState.valid;

  return (
    <RecoveryShell eyebrow="Secure Access" title={title} description={description}>
      <form className="apple-recovery-form" onSubmit={onSubmit}>
        {tokenState.loading ? <StatusAlert tone="notice">Checking secure link…</StatusAlert> : null}
        {showInvalidLink ? (
          <StatusAlert>
            This link has expired or is no longer valid. <Link to={expiredLink.to}>{expiredLink.label}</Link>
          </StatusAlert>
        ) : null}
        {state.ok ? <StatusAlert tone="success">Password saved. Redirecting to login…</StatusAlert> : null}
        {state.err ? <StatusAlert>{state.err}</StatusAlert> : null}

        <div className="apple-recovery-input-card">
          <PasswordInput
            label="New"
            value={pw}
            onChange={(event) => setPw(event.target.value)}
            visible={showPw}
            onToggleVisibility={() => setShowPw((value) => !value)}
            placeholder="Enter new password"
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirm"
            value={pw2}
            onChange={(event) => setPw2(event.target.value)}
            visible={showPw2}
            onToggleVisibility={() => setShowPw2((value) => !value)}
            placeholder="Re-enter new password"
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="apple-recovery-primary-button" disabled={submitDisabled}>
          {state.loading ? "Saving…" : "Save Password"}
        </button>

        <div className="apple-recovery-links centered">
          <Link to="/login">Back to login</Link>
        </div>
      </form>
    </RecoveryShell>
  );
}

export function ForgotPasswordPage() {
  return (
    <RequestEmailPage
      mode="reset"
      eyebrow="Password Recovery"
      title="Reset your password."
      description="Enter your account email and we will send a secure, single-use reset link if the account is eligible."
      endpoint="/api/auth/forgot-password"
      submitLabel="Send Reset Link"
      footerLink={{
        to: "/resend-setup-link",
        label: "Need setup link?",
      }}
    />
  );
}

export function ResendSetupLinkPage() {
  return (
    <RequestEmailPage
      mode="setup"
      eyebrow="Account Setup"
      title="Request a fresh setup link."
      description="If your invitation link expired, enter the approved account email and we will send a fresh setup link when eligible."
      endpoint="/api/auth/resend-setup-link"
      submitLabel="Send Setup Link"
      footerLink={{
        to: "/forgot-password",
        label: "Forgot password?",
      }}
    />
  );
}

export function ResetPasswordPage() {
  return (
    <SetNewPasswordPage
      purpose="RESET_PASSWORD"
      endpoint="/api/auth/reset-password"
      title="Choose a new password."
      description="Use this secure recovery link to set a new password for your Meitu account."
      expiredLink={{
        to: "/forgot-password",
        label: "Request a new reset link.",
      }}
    />
  );
}

export function SetupPasswordPage() {
  return (
    <SetNewPasswordPage
      purpose="SETUP_PASSWORD"
      endpoint="/api/auth/set-password"
      title="Set your account password."
      description="Complete your approved dealer or dispatcher account setup with a secure one-time activation link."
      expiredLink={{
        to: "/resend-setup-link",
        label: "Request a fresh setup link.",
      }}
    />
  );
}

// Landing page for the confirmation link sent by POST /api/dealer/apply -
// unlike SetNewPasswordPage, this auto-confirms on mount (no form to submit,
// clicking the emailed link is the whole action) and, on an expired token,
// offers an inline resend rather than sending the applicant back through the
// full application form again.
export function ConfirmDealerEmailPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);
  const [state, setState] = useState({ loading: true, ok: false, expired: false, err: "" });
  const [resendEmail, setResendEmail] = useState("");
  const [resendState, setResendState] = useState({ loading: false, sent: false, err: "", message: "" });

  useEffect(() => {
    let cancelled = false;

    async function confirm() {
      if (!token) {
        setState({ loading: false, ok: false, expired: false, err: "Missing token in link." });
        return;
      }

      try {
        await api.post("/api/dealer/verify-email", { token });
        if (!cancelled) setState({ loading: false, ok: true, expired: false, err: "" });
      } catch (error) {
        if (!cancelled) {
          const code = error?.response?.data?.code;
          setState({
            loading: false,
            ok: false,
            expired: code === "EXPIRED",
            err: getApiErrorMessage(error, "Unable to confirm this link."),
          });
        }
      }
    }

    confirm();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onResend = async (event) => {
    event.preventDefault();
    setResendState({ loading: true, sent: false, err: "", message: "" });

    try {
      const { data } = await api.post("/api/dealer/resend-verification-email", { email: resendEmail });
      setResendState({ loading: false, sent: true, err: "", message: data?.message || "" });
    } catch (error) {
      setResendState({
        loading: false,
        sent: false,
        err: getApiErrorMessage(error, "Unable to resend confirmation link."),
        message: "",
      });
    }
  };

  return (
    <RecoveryShell
      eyebrow="Dealer Application"
      title="Confirm your email."
      description="Confirming your email lets us review your Meitu Paints dealer application."
    >
      <div className="apple-recovery-form">
        {state.loading ? <StatusAlert tone="notice">Confirming your email…</StatusAlert> : null}
        {state.ok ? (
          <StatusAlert tone="success">
            Email confirmed. Your application is now under review — we'll be in touch soon.
          </StatusAlert>
        ) : null}
        {!state.loading && !state.ok ? <StatusAlert>{state.err}</StatusAlert> : null}

        {!state.loading && !state.ok && state.expired ? (
          <>
            {resendState.sent ? (
              <StatusAlert tone="success">
                {resendState.message || "If an eligible application exists, a confirmation link has been sent."}
              </StatusAlert>
            ) : (
              <form onSubmit={onResend}>
                {resendState.err ? <StatusAlert>{resendState.err}</StatusAlert> : null}
                <div className="apple-recovery-input-card">
                  <div className="apple-recovery-field">
                    <label htmlFor="resend-email">Email</label>
                    <div className="apple-recovery-single-row">
                      <input
                        id="resend-email"
                        type="email"
                        value={resendEmail}
                        onChange={(event) => setResendEmail(event.target.value)}
                        placeholder="name@example.com"
                        autoComplete="email"
                        required
                      />
                      <button
                        type="submit"
                        className="apple-recovery-icon-submit"
                        disabled={resendState.loading}
                        aria-label="Resend confirmation link"
                      >
                        {resendState.loading ? "…" : <ArrowRightIcon />}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </>
        ) : null}

        <div className="apple-recovery-links centered">
          <Link to="/">Back to home</Link>
        </div>
      </div>
    </RecoveryShell>
  );
}
