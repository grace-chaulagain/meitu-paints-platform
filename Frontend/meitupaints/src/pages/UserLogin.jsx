import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import { getApiErrorMessage } from "../api/client.js";
import { setAccessToken } from "../api/client.js";
import { loginStart, loginSuccess, loginFailure } from "../redux/userSlice.js";

const featureCards = [
  {
    title: "Fast Access",
    desc: "Secure sign-in for approved dealer accounts.",
  },
  {
    title: "Clear Workflow",
    desc: "Professional experience from catalog to order review.",
  },
  {
    title: "Enterprise Ready",
    desc: "Built for reliable day-to-day wholesale ordering.",
  },
];

const shellStyle = {
  minHeight: "100vh",
  background:
    "radial-gradient(900px 520px at 10% 0%, rgba(255,230,160,.42), transparent 52%), radial-gradient(900px 520px at 88% 12%, rgba(255,120,80,.14), transparent 44%), linear-gradient(180deg, #f6f7f9 0%, #eef2f6 100%)",
  padding: "96px 20px 48px",
};

const glassPanel = {
  borderRadius: 34,
  border: "1px solid rgba(255,255,255,.72)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  boxShadow:
    "0 24px 70px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.84)",
};

const inputStyle = {
  width: "100%",
  height: 56,
  borderRadius: 18,
  border: "1px solid rgba(0,0,0,.08)",
  background: "rgba(255,255,255,.96)",
  padding: "0 16px",
  fontWeight: 800,
  color: "#111827",
  outline: "none",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.88)",
};

const labelStyle = {
  display: "block",
  marginBottom: 8,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "rgba(0,0,0,.5)",
};

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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (!location.search.includes("session=expired")) return;
    const returnTo = getSafeReturnTo(location.search);
    const nextUrl = returnTo
      ? `/login?returnTo=${encodeURIComponent(returnTo)}`
      : "/login";
    window.history.replaceState(null, "", nextUrl);
  }, [location.search]);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 992);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
    <div
      style={{
        ...shellStyle,
        padding: isMobile ? "84px 14px 28px" : shellStyle.padding,
      }}
    >
      <div className="container" style={{ maxWidth: 1180 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.05fr .95fr",
            gap: isMobile ? 16 : 24,
            alignItems: "stretch",
          }}
        >
          <div
            style={{
              ...glassPanel,
              position: "relative",
              overflow: "hidden",
              background:
                "linear-gradient(180deg, rgba(255,255,255,.8) 0%, rgba(255,255,255,.6) 100%)",
              padding: isMobile ? 22 : 34,
              minHeight: isMobile ? "auto" : 640,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              order: isMobile ? 2 : 1,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(circle at 18% 16%, rgba(255,255,255,.88), transparent 24%), radial-gradient(circle at 84% 80%, rgba(209,0,0,.08), transparent 26%), linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,0))",
                pointerEvents: "none",
              }}
            />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  display: "inline-flex",
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,.74)",
                  border: "1px solid rgba(0,0,0,.05)",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: ".08em",
                  textTransform: "uppercase",
                  color: "rgba(0,0,0,.56)",
                }}
              >
                Meitu Dealer Portal
              </div>

              <div
                style={{
                  marginTop: isMobile ? 18 : 22,
                  fontSize: isMobile ? 34 : 52,
                  lineHeight: isMobile ? 1.02 : 0.96,
                  letterSpacing: isMobile ? "-0.05em" : "-0.06em",
                  fontWeight: 950,
                  color: "#0f172a",
                  maxWidth: 560,
                }}
              >
                Professional ordering for modern dealers.
              </div>

              <div
                style={{
                  marginTop: 18,
                  maxWidth: 540,
                  color: "rgba(0,0,0,.58)",
                  fontWeight: 700,
                  fontSize: isMobile ? 14 : 16,
                  lineHeight: 1.65,
                }}
              >
                Access your Meitu account to browse the catalog, build orders,
                and manage dealer operations with a clean, enterprise-grade
                experience.
              </div>
            </div>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : "repeat(3, minmax(0, 1fr))",
                gap: 14,
                marginTop: isMobile ? 20 : 0,
              }}
            >
              {featureCards.map((item) => (
                <div
                  key={item.title}
                  style={{
                    borderRadius: 22,
                    padding: isMobile ? 16 : 18,
                    background: "rgba(255,255,255,.6)",
                    border: "1px solid rgba(255,255,255,.62)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.78)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 900,
                      letterSpacing: "-0.02em",
                      color: "#111827",
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      lineHeight: 1.55,
                      color: "rgba(0,0,0,.58)",
                      fontWeight: 700,
                    }}
                  >
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              ...glassPanel,
              background:
                "linear-gradient(180deg, rgba(255,255,255,.86) 0%, rgba(255,255,255,.72) 100%)",
              padding: isMobile ? 22 : 34,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              order: 1,
            }}
          >
            <div style={{ maxWidth: 440, width: "100%", margin: "0 auto" }}>
              <div
                style={{
                  fontSize: isMobile ? 28 : 34,
                  fontWeight: 950,
                  letterSpacing: "-0.05em",
                  color: "#0f172a",
                }}
              >
                Welcome back
              </div>
              <div
                style={{
                  marginTop: 10,
                  color: "rgba(0,0,0,.56)",
                  fontWeight: 700,
                  lineHeight: 1.6,
                  fontSize: isMobile ? 14 : 15,
                }}
              >
                Sign in to continue to your dealer workspace.
              </div>

              <div
                style={{
                  marginTop: 24,
                  padding: 18,
                  borderRadius: 24,
                  background: "rgba(248,248,250,.92)",
                  border: "1px solid rgba(0,0,0,.05)",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(0,0,0,.52)",
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  Don’t have an account yet?
                </div>

                <Link
                  to="/dealership/register"
                  className="text-decoration-none"
                  style={{
                    height: 50,
                    borderRadius: 16,
                    border: "1px solid rgba(0,0,0,.08)",
                    background: "rgba(255,255,255,.96)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#111827",
                    fontWeight: 900,
                    letterSpacing: "-0.01em",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.9)",
                  }}
                >
                  Create account
                </Link>
              </div>

              {state.err ? (
                <div
                  style={{
                    marginTop: 18,
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "rgba(180,35,24,.08)",
                    border: "1px solid rgba(180,35,24,.16)",
                    color: "#b42318",
                    fontWeight: 800,
                    lineHeight: 1.5,
                  }}
                >
                  {state.err}
                </div>
              ) : null}

              {sessionNotice ? (
                <div
                  style={{
                    marginTop: 18,
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "rgba(180,83,9,.08)",
                    border: "1px solid rgba(180,83,9,.16)",
                    color: "#92400e",
                    fontWeight: 800,
                    lineHeight: 1.5,
                  }}
                >
                  {sessionNotice}
                </div>
              ) : null}

              <form
                onSubmit={onSubmit}
                style={{ marginTop: 22, display: "grid", gap: 16 }}
              >
                <div>
                  <label style={labelStyle}>Email</label>
                  <input
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      style={{ ...inputStyle, paddingRight: 58 }}
                    />
                    <button
                      type="button"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((value) => !value)}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 38,
                        height: 38,
                        display: "inline-grid",
                        placeItems: "center",
                        borderRadius: 12,
                        border: "1px solid rgba(0,0,0,.07)",
                        background: "rgba(255,255,255,.9)",
                        color: "rgba(15,23,42,.72)",
                        cursor: "pointer",
                      }}
                    >
                      <EyeIcon hidden={showPassword} />
                    </button>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      marginTop: 10,
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    <Link
                      to="/forgot-password"
                      style={{ color: "#b42318", textDecoration: "none" }}
                    >
                      Forgot password?
                    </Link>
                    <Link
                      to="/resend-setup-link"
                      style={{ color: "#475467", textDecoration: "none" }}
                    >
                      Need a new setup link?
                    </Link>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={state.loading}
                  style={{
                    marginTop: 4,
                    height: 58,
                    borderRadius: 18,
                    border: "1px solid rgba(196,0,0,.18)",
                    background: state.loading
                      ? "rgba(0,0,0,.10)"
                      : "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)",
                    color: "#fff",
                    fontWeight: 950,
                    fontSize: 15,
                    letterSpacing: "-0.01em",
                    cursor: state.loading ? "not-allowed" : "pointer",
                    boxShadow: state.loading
                      ? "none"
                      : "0 18px 34px rgba(196,0,0,.22)",
                  }}
                >
                  {state.loading ? "Logging in..." : "Login"}
                </button>

                <div
                  style={{
                    marginTop: 4,
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "rgba(248,248,250,.9)",
                    border: "1px solid rgba(0,0,0,.05)",
                    color: "rgba(0,0,0,.58)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontWeight: 700,
                  }}
                >
                  If you’re approved but can’t login yet, check your email for
                  the password setup link.
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
