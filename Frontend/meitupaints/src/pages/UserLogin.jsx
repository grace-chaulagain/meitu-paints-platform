import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { getApiErrorMessage, setAccessToken } from "../api/client.js";
import { loginStart, loginSuccess, loginFailure } from "../redux/userSlice.js";
import NavBar from "../components/NavBar.jsx";

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

const SESSION_EXPIRED_KEY = "meitu.sessionExpired";
const SESSION_EXPIRED_MESSAGE =
  "Your secure session has expired. Please sign in again to continue.";

function getInitialSessionNotice() {
  if (typeof window === "undefined") return "";

  const params = new URLSearchParams(window.location.search);
  const expired =
    params.get("session") === "expired" ||
    sessionStorage.getItem(SESSION_EXPIRED_KEY) === "1";

  if (!expired) return "";

  sessionStorage.removeItem(SESSION_EXPIRED_KEY);
  return SESSION_EXPIRED_MESSAGE;
}

function getSafeReturnTo(search = "") {
  const params = new URLSearchParams(search || "");
  const raw = params.get("returnTo") || "";
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "";
  if (raw.startsWith("/login")) return "";
  return raw;
}

export default function UserLogin() {
  const nav = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const dispatch = useDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState({ loading: false, err: "" });
  const [sessionNotice, setSessionNotice] = useState(getInitialSessionNotice);

  useEffect(() => {
    if (!location.search.includes("session=expired")) return;
    const returnTo = getSafeReturnTo(location.search);
    const nextUrl = returnTo
      ? `/login?returnTo=${encodeURIComponent(returnTo)}`
      : "/login";
    window.history.replaceState(null, "", nextUrl);
  }, [location.search]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setState({ loading: true, err: "" });
    setSessionNotice("");
    dispatch(loginStart());

    try {
      const authData = await login({ email, password });
      if (authData?.accessToken) {
        setAccessToken(authData.accessToken);
        localStorage.setItem("accessToken", authData.accessToken);
      }

      const role = String(authData?.user?.role || "").toUpperCase();

      dispatch(
        loginSuccess({
          user: authData?.user || null,
          role,
          dealerProfile:
            role === "DEALER" ? authData?.dealerProfile || null : null,
        }),
      );

      const defaultDestination =
        role === "ADMIN"
          ? "/admin/dashboard"
          : role === "DISPATCHER"
            ? "/dispatcher/dashboard"
            : role === "FACTORY"
              ? "/factory/dashboard"
              : role === "DEALER"
                ? "/dealer/catalog"
                : "/";

      nav(getSafeReturnTo(location.search) || defaultDestination);
    } catch (err) {
      const message = getApiErrorMessage(
        err,
        "Login failed. Please check your credentials.",
      );

      dispatch(loginFailure(message));
      setState({
        loading: false,
        err: message,
      });
    }
  };

  return (
    <>
      <NavBar />

      <main className="apple-login-page">
        <Link to="/" className="apple-login-logo" aria-label="Back to home">
          <img src="/meitulogo.svg" alt="Meitu Paints" />
        </Link>

        <section className="apple-login-card" aria-labelledby="login-title">
          <div className="apple-login-kicker">Meitu Account</div>
          <h1 id="login-title">Sign in to Meitu Paints</h1>
          <p className="apple-login-subtitle">
            Use your approved account to access your workspace.
          </p>

          {state.err ? (
            <div className="apple-login-alert error" role="alert">
              {state.err}
            </div>
          ) : null}

          {sessionNotice ? (
            <div className="apple-login-alert notice" role="status">
              {sessionNotice}
            </div>
          ) : null}

          <form className="apple-login-form" onSubmit={onSubmit}>
            <div className="apple-login-input-card">
              <div className="apple-login-field">
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="apple-login-divider" />

              <div className="apple-login-field password">
                <label htmlFor="login-password">Password</label>
                <div className="apple-login-password-row">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="apple-login-quiet-button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    <EyeIcon hidden={showPassword} />
                  </button>
                  <button
                    type="submit"
                    className="apple-login-submit"
                    disabled={state.loading}
                    aria-label="Continue"
                  >
                    {state.loading ? "..." : <ArrowRightIcon />}
                  </button>
                </div>
              </div>
            </div>
          </form>

          <div className="apple-login-links">
            <Link to="/forgot-password">Forgot password?</Link>
            <Link to="/resend-setup-link">Need a new setup link?</Link>
            <Link to="/dealership/register">Create dealer account</Link>
            <Link to="/dispatcher/apply">Create dispatcher account</Link>
          </div>
        </section>

        <p className="apple-login-footnote">
          Admin, dealer, dispatcher, and factory accounts use the same secure
          sign-in.
        </p>

        <style>{`
        .apple-login-page{
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

        .apple-login-logo{
          width:56px;
          height:56px;
          margin-bottom:30px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          text-decoration:none;
        }

        .apple-login-logo img{
          width:52px;
          height:52px;
          object-fit:contain;
          display:block;
        }

        .apple-login-card{
          width:min(100%, 480px);
          text-align:center;
        }

        .apple-login-kicker{
          color:#707070;
          font-size:14px;
          line-height:1.3;
          font-weight:600;
          letter-spacing:-.003em;
        }

        .apple-login-card h1{
          margin:8px 0 0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
          font-size:clamp(34px, 6vw, 48px);
          line-height:1.08;
          font-weight:700;
          letter-spacing:-.022em;
        }

        .apple-login-subtitle{
          width:min(100%, 360px);
          margin:12px auto 0;
          color:#707070;
          font-size:17px;
          line-height:1.45;
          font-weight:400;
          letter-spacing:-.006em;
        }

        .apple-login-form{
          margin-top:30px;
        }

        .apple-login-input-card{
          overflow:hidden;
          border-radius:18px;
          background:#fff;
          border:1px solid #d2d2d7;
          text-align:left;
          transition:border-color .16s ease, background-color .16s ease;
        }

        .apple-login-input-card:focus-within{
          border-color:#86868b;
          background:#fff;
        }

        .apple-login-field{
          display:grid;
          grid-template-columns:92px minmax(0, 1fr);
          align-items:center;
          min-height:58px;
          padding:0 10px 0 16px;
        }

        .apple-login-field.password{
          grid-template-columns:92px minmax(0, 1fr);
        }

        .apple-login-field label{
          color:#707070;
          font-size:13px;
          line-height:1;
          font-weight:400;
          letter-spacing:-.003em;
        }

        .apple-login-field input{
          width:100%;
          height:58px;
          border:0 !important;
          border-radius:0 !important;
          background:#fff !important;
          background-color:#fff !important;
          background-image:none !important;
          background-clip:padding-box !important;
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

        .apple-login-field input:focus,
        .apple-login-field input:focus-visible{
          background:#fff !important;
          background-color:#fff !important;
          background-image:none !important;
          border:0 !important;
          outline:0 !important;
          box-shadow:none !important;
        }

        .apple-login-field input:autofill,
        .apple-login-field input:-webkit-autofill,
        .apple-login-field input:-webkit-autofill:hover,
        .apple-login-field input:-webkit-autofill:focus,
        .apple-login-field input:-webkit-autofill:active{
          background:#fff !important;
          background-color:#fff !important;
          background-image:none !important;
          -webkit-text-fill-color:#1d1d1f !important;
          caret-color:#1d1d1f !important;
          box-shadow:0 0 0 1000px #fff inset !important;
          -webkit-box-shadow:0 0 0 1000px #fff inset !important;
          transition:background-color 9999s ease-in-out 0s !important;
        }

        .apple-login-field input:-webkit-autofill::first-line{
          color:#1d1d1f !important;
          font-family:var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif) !important;
          font-size:17px !important;
          font-weight:400 !important;
        }

        .apple-login-field input::selection{
          background:transparent;
          color:#1d1d1f;
        }

        .apple-login-field:focus-within label{
          color:#1d1d1f;
        }

        .apple-login-field input::placeholder{
          color:#86868b;
        }

        .apple-login-divider{
          height:1px;
          background:#e8e8ed;
          margin-left:16px;
        }

        .apple-login-password-row{
          display:grid;
          grid-template-columns:minmax(0, 1fr) 36px 36px;
          align-items:center;
          gap:6px;
        }

        .apple-login-quiet-button,
        .apple-login-submit{
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

        .apple-login-quiet-button:focus,
        .apple-login-quiet-button:focus-visible,
        .apple-login-submit:focus,
        .apple-login-submit:focus-visible{
          outline:0;
          box-shadow:none;
        }

        .apple-login-quiet-button{
          border:0;
          background:transparent;
          color:#707070;
        }

        .apple-login-quiet-button:hover{
          background:#f5f5f7;
          color:#1d1d1f;
        }

        .apple-login-submit{
          border:1px solid #86868b;
          background:#fff;
          color:#1d1d1f;
        }

        .apple-login-submit:hover:not(:disabled){
          background:#1d1d1f;
          border-color:#1d1d1f;
          color:#fff;
        }

        .apple-login-submit:disabled{
          cursor:not-allowed;
          opacity:.48;
        }

        .apple-login-alert{
          margin:20px auto 0;
          width:min(100%, 420px);
          border-radius:14px;
          padding:12px 14px;
          text-align:left;
          font-size:13px;
          line-height:1.45;
          font-weight:500;
        }

        .apple-login-alert.error{
          background:rgba(182,68,0,.08);
          border:1px solid rgba(182,68,0,.18);
          color:#b64400;
        }

        .apple-login-alert.notice{
          background:#fff;
          border:1px solid #e8e8ed;
          color:#474747;
        }

        .apple-login-links{
          margin-top:22px;
          display:grid;
          gap:10px;
          justify-items:center;
          font-size:14px;
          line-height:1.35;
        }

        .apple-login-links a{
          color:#0066cc;
          text-decoration:none;
        }

        .apple-login-links a:hover{
          text-decoration:underline;
        }

        .apple-login-footnote{
          width:min(100%, 420px);
          margin:28px auto 0;
          color:#707070;
          text-align:center;
          font-size:12px;
          line-height:1.45;
        }

        @media (max-width:560px){
          .apple-login-page{
            justify-content:flex-start;
            padding-top:64px;
          }

          .apple-login-logo{
            margin-bottom:24px;
          }

          .apple-login-field,
          .apple-login-field.password{
            grid-template-columns:1fr;
            align-items:start;
            gap:4px;
            padding:10px 12px 8px;
          }

          .apple-login-field input{
            height:38px;
          }

          .apple-login-password-row{
            width:100%;
          }

          .apple-login-divider{
            margin-left:12px;
          }
        }
      `}</style>
      </main>
    </>
  );
}
