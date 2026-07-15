import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";

const INQUIRY_ENDPOINT = (import.meta.env.VITE_INQUIRY_ENDPOINT || "").trim();

const quickTopics = [
  "Product recommendation",
  "Color selection",
  "Texture consultation",
  "Dealer support",
];

function ArrowIcon({ size = 17 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h13" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3 20 6v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V6l8-3Z" />
      <path d="m8.5 12 2.4 2.4 4.8-5" />
    </svg>
  );
}

const InquiryForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [pageReady, setPageReady] = useState(false);

  const prefillSubject = useMemo(() => {
    const fromState = location?.state?.defaultSubject;
    if (typeof fromState === "string" && fromState.trim()) {
      return fromState.trim();
    }

    try {
      const sp = new URLSearchParams(location?.search || "");
      const qs = sp.get("subject");
      if (typeof qs === "string" && qs.trim()) return qs.trim();
    } catch {
      // Ignore malformed subject query strings and fall back to blank.
    }

    return "";
  }, [location?.state, location?.search]);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPageReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!prefillSubject) return;

    setForm((prev) => {
      if (prev.subject && prev.subject.trim().length > 0) return prev;
      return { ...prev, subject: prefillSubject };
    });
  }, [prefillSubject, location?.key]);

  const payload = useMemo(
    () => ({
      name: form.name,
      email: form.email,
      phone: form.phone,
      subject: form.subject,
      message: form.message,
      page: typeof window !== "undefined" ? window.location.pathname : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      createdAt: new Date().toISOString(),
    }),
    [form],
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  async function postToAppsScript(data) {
    if (!INQUIRY_ENDPOINT) {
      throw new Error("Inquiry endpoint is not configured.");
    }

    await fetch(INQUIRY_ENDPOINT, {
      method: "POST",
      body: JSON.stringify(data),
    });

    return true;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;

    setSending(true);
    setSent(false);
    setErrMsg("");

    try {
      await postToAppsScript(payload);

      setForm({
        name: "",
        email: "",
        phone: "",
        subject: prefillSubject || "",
        message: "",
      });
      setSent(true);
    } catch (err) {
      setErrMsg(err?.message || "Error sending message. Please try again.");
      alert(err?.message || "Error sending message. Please try again later.");
    } finally {
      setSending(false);
    }
  };

  const applyTopic = (topic) => {
    setForm((prev) => ({
      ...prev,
      subject: prev.subject?.trim() ? prev.subject : topic,
    }));
  };

  return (
    <>
      <NavBar />
      <main className={`apple-inquiry-page ${pageReady ? "is-ready" : ""}`}>
        <section className="inquiry-form-section load-section" id="inquiry-form">
          <div className="inquiry-form-intro">
            <button
              type="button"
              className="inquiry-back"
              onClick={() => navigate(-1)}
            >
              <span aria-hidden="true">‹</span>
              Back
            </button>
            <p>Inquiry</p>
            <h2>Send a clear request.</h2>
            <span>
              Fill the form first. Add a topic if useful, then include product,
              shade, texture, quantity, or location details in the message.
            </span>

            <div className="topic-cloud" aria-label="Inquiry topic shortcuts">
              {quickTopics.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => applyTopic(topic)}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          <form className="inquiry-form-card" onSubmit={handleSubmit}>
            <div className="form-status-row">
              <div>
                <p>Send inquiry</p>
                <h3>Request details</h3>
              </div>
              <span
                className={`inquiry-status ${sending ? "busy" : ""} ${
                  sent ? "sent" : ""
                }`}
                aria-live="polite"
              >
                {sending ? "Sending" : sent ? "Sent" : "Ready"}
              </span>
            </div>

            <div className="inquiry-fields">
              <label>
                <span>Full name</span>
                <input
                  type="text"
                  name="name"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                <span>Phone</span>
                <input
                  type="tel"
                  name="phone"
                  placeholder="98XXXXXXXX"
                  value={form.phone}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                <span>Subject</span>
                <input
                  type="text"
                  name="subject"
                  placeholder="Product, color, texture, or pricing"
                  value={form.subject}
                  onChange={handleChange}
                />
              </label>

              <label className="wide">
                <span>Message</span>
                <textarea
                  rows="7"
                  name="message"
                  placeholder="Tell us what you need and include any relevant product, shade, texture, quantity, or location details."
                  value={form.message}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              className="inquiry-submit"
              disabled={sending}
            >
              <span>{sending ? "Submitting" : "Submit inquiry"}</span>
              {sending ? <i aria-hidden="true" /> : <ArrowIcon />}
            </button>

            {errMsg ? (
              <div className="inquiry-error" role="alert">
                {errMsg}
              </div>
            ) : null}

            <div className="form-footer-note">
              <span>By submitting, you agree to be contacted about this inquiry.</span>
              <Link to="/support">
                Help and support <ArrowIcon size={14} />
              </Link>
            </div>
          </form>
        </section>

        <section className="inquiry-top load-section">
          <div className="inquiry-copy">
            <p>Before submitting</p>
            <h1>Better details help us answer faster.</h1>
            <span>
              Keep the request practical. Product, color code, texture code,
              surface type, quantity, project area, and city are the most useful
              details.
            </span>
            <div className="inquiry-actions">
              <Link to="/support" className="inquiry-link">
                Support <ArrowIcon />
              </Link>
            </div>
          </div>

          <aside className="inquiry-guide">
            <h2>What to include</h2>
            <ul>
              <li>Product, color code, texture code, or surface type.</li>
              <li>Quantity, room size, or project area if pricing is needed.</li>
              <li>City or dealer area if you need local support.</li>
            </ul>
            <div className="privacy-note">
              <ShieldIcon />
              <div>
                <strong>Private by default.</strong>
                <small>Your details are used only for Meitu follow-up.</small>
              </div>
            </div>
          </aside>
        </section>
      </main>

      <style>{`
        .apple-inquiry-page{
          min-height:100vh;
          background:#f5f5f7;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-text, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }

        .apple-inquiry-page svg{
          width:1em;
          height:1em;
          fill:none;
          stroke:currentColor;
          stroke-width:2;
          stroke-linecap:round;
          stroke-linejoin:round;
        }

        .apple-inquiry-page a{
          text-decoration:none;
        }

        .load-section{
          opacity:0;
          transform:translateY(18px);
          transition:
            opacity .46s cubic-bezier(.22,.61,.36,1),
            transform .46s cubic-bezier(.22,.61,.36,1);
          will-change:opacity, transform;
        }

        .apple-inquiry-page.is-ready .load-section{
          opacity:1;
          transform:translateY(0);
        }

        .apple-inquiry-page.is-ready .load-section:nth-of-type(2){
          transition-delay:.08s;
        }

        .inquiry-top,
        .inquiry-form-section{
          width:min(1080px, calc(100vw - 40px));
          margin:0 auto;
        }

        .inquiry-top{
          margin-top:clamp(90px, 18vh, 190px);
          padding:0 0 76px;
          display:grid;
          grid-template-columns:minmax(0,1fr) 360px;
          gap:22px;
          align-items:start;
        }

        .inquiry-copy > p,
        .inquiry-form-intro > p,
        .form-status-row p{
          margin:22px 0 8px;
          color:#707070;
          font-size:12px;
          line-height:1.33;
          font-weight:600;
          text-transform:uppercase;
          letter-spacing:-.003em;
        }

        .inquiry-form-intro > .inquiry-back + p{
          margin-top:34px;
        }

        .inquiry-copy h1{
          max-width:700px;
          margin:0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          font-size:clamp(44px, 7vw, 76px);
          line-height:1.04;
          letter-spacing:-1.4px;
          font-weight:700;
        }

        .inquiry-top .inquiry-copy h1{
          max-width:560px;
          font-size:clamp(30px, 4vw, 44px);
          letter-spacing:-.7px;
          line-height:1.1;
        }

        .inquiry-copy > span,
        .inquiry-form-intro > span{
          display:block;
          max-width:620px;
          margin-top:14px;
          color:#707070;
          font-size:18px;
          line-height:1.45;
        }

        .inquiry-back{
          height:32px;
          display:inline-flex;
          align-items:center;
          gap:7px;
          padding:0;
          border:0;
          background:transparent;
          color:#0066cc;
          font-size:14px;
          font-weight:400;
          cursor:pointer;
          letter-spacing:-.04px;
        }

        .inquiry-back span{
          width:22px;
          height:22px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:rgba(210,210,215,.64);
          color:#1d1d1f;
          font-size:22px;
          line-height:.82;
          padding-bottom:2px;
          transition:background-color .18s ease, transform .18s ease;
        }

        .inquiry-back:hover span{
          background:#e8e8ed;
          transform:translateX(-1px);
        }

        .inquiry-actions{
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap:18px;
          margin-top:24px;
        }

        .inquiry-pill,
        .inquiry-link{
          display:inline-flex;
          align-items:center;
          gap:8px;
          color:#0066cc;
          font-size:17px;
          line-height:1.24;
          font-weight:400;
        }

        .inquiry-pill.primary{
          min-height:42px;
          padding:0 18px;
          border-radius:999px;
          background:#0071e3;
          color:#fff;
        }

        .inquiry-guide,
        .inquiry-form-card,
        .privacy-note{
          background:#fff;
          border:1px solid #e8e8ed;
          border-radius:28px;
          box-shadow:none;
        }

        .inquiry-guide{
          padding:22px;
        }

        .inquiry-guide h2{
          margin:0;
          color:#1d1d1f;
          font-size:20px;
          line-height:1.2;
          font-weight:600;
          letter-spacing:-.2px;
        }

        .inquiry-guide ul{
          margin:14px 0 0;
          padding-left:18px;
          color:#707070;
          font-size:14px;
          line-height:1.5;
        }

        .inquiry-guide li + li{
          margin-top:8px;
        }

        .privacy-note{
          display:flex;
          gap:12px;
          align-items:flex-start;
          margin-top:18px;
          padding:14px;
          background:#f5f5f7;
        }

        .privacy-note svg{
          flex:0 0 20px;
          color:#1d1d1f;
        }

        .privacy-note strong{
          display:block;
          color:#1d1d1f;
          font-size:14px;
          line-height:1.25;
          font-weight:600;
        }

        .privacy-note small{
          display:block;
          margin-top:3px;
          color:#707070;
          font-size:12px;
          line-height:1.35;
        }

        .inquiry-form-section{
          display:grid;
          grid-template-columns:320px minmax(0,1fr);
          gap:22px;
          align-items:start;
          padding:56px 0 34px;
        }

        .inquiry-form-intro{
          position:sticky;
          top:70px;
          padding-top:6px;
        }

        .inquiry-form-intro > p{
          margin-top:0;
        }

        .inquiry-form-intro h2{
          margin:0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          font-size:34px;
          line-height:1.1;
          letter-spacing:-.5px;
          font-weight:700;
        }

        .inquiry-form-intro > span{
          font-size:15px;
        }

        .topic-cloud{
          display:flex;
          flex-wrap:wrap;
          gap:9px;
          margin-top:20px;
        }

        .topic-cloud button{
          min-height:36px;
          padding:0 13px;
          border:0;
          border-radius:999px;
          background:rgba(210,210,215,.64);
          color:rgba(0,0,0,.72);
          font:inherit;
          font-size:14px;
          font-weight:500;
          cursor:pointer;
        }

        .topic-cloud button:hover{
          background:#fff;
        }

        .inquiry-form-card{
          padding:28px;
        }

        .form-status-row{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:18px;
          margin-bottom:22px;
        }

        .form-status-row p{
          margin:0 0 6px;
        }

        .form-status-row h3{
          margin:0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          font-size:28px;
          line-height:1.14;
          letter-spacing:-.36px;
          font-weight:700;
        }

        .inquiry-status{
          min-height:34px;
          display:inline-flex;
          align-items:center;
          padding:0 13px;
          border-radius:999px;
          background:#f5f5f7;
          color:#707070;
          font-size:13px;
          font-weight:600;
        }

        .inquiry-status.busy{
          color:#1d1d1f;
        }

        .inquiry-status.sent{
          color:#0066cc;
        }

        .inquiry-fields{
          display:grid;
          grid-template-columns:repeat(2, minmax(0,1fr));
          gap:14px;
        }

        .inquiry-fields label{
          display:grid;
          gap:8px;
        }

        .inquiry-fields label.wide{
          grid-column:1 / -1;
        }

        .inquiry-fields label span{
          color:#474747;
          font-size:13px;
          font-weight:600;
        }

        .inquiry-fields input,
        .inquiry-fields textarea{
          width:100%;
          border:1px solid #e8e8ed;
          border-radius:18px;
          background:#f5f5f7;
          color:#1d1d1f;
          padding:14px 15px;
          font:inherit;
          font-size:15px;
          line-height:1.4;
          outline:none;
          box-shadow:none;
          transition:border-color .18s ease, background-color .18s ease;
          -webkit-appearance:none;
          appearance:none;
        }

        .inquiry-fields textarea{
          resize:vertical;
          min-height:164px;
        }

        .inquiry-fields input::placeholder,
        .inquiry-fields textarea::placeholder{
          color:#8a8a8e;
        }

        .inquiry-fields input:focus,
        .inquiry-fields textarea:focus{
          border-color:#1d1d1f;
          background:#fff;
        }

        .inquiry-submit{
          width:100%;
          min-height:48px;
          margin-top:18px;
          border:0;
          border-radius:999px;
          background:#0071e3;
          color:#fff;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:10px;
          font-size:17px;
          font-weight:400;
          cursor:pointer;
        }

        .inquiry-submit:disabled{
          cursor:not-allowed;
          opacity:.82;
        }

        .inquiry-submit i{
          width:16px;
          height:16px;
          border-radius:999px;
          border:2px solid rgba(255,255,255,.42);
          border-top-color:#fff;
          animation:spin .8s linear infinite;
        }

        .inquiry-error{
          margin-top:14px;
          padding:13px 14px;
          border-radius:18px;
          background:#fff4f4;
          color:#b64400;
          font-size:14px;
          line-height:1.35;
        }

        .form-footer-note{
          display:flex;
          justify-content:space-between;
          gap:14px;
          flex-wrap:wrap;
          margin-top:16px;
          color:#707070;
          font-size:12px;
          line-height:1.35;
        }

        .form-footer-note a{
          display:inline-flex;
          align-items:center;
          gap:5px;
          color:#0066cc;
          font-weight:500;
        }

        @keyframes spin{
          to{ transform:rotate(360deg); }
        }

        @media (max-width:900px){
          .inquiry-top,
          .inquiry-form-section{
            grid-template-columns:1fr;
          }

          .inquiry-form-intro{
            position:relative;
            top:auto;
          }
        }

        @media (max-width:640px){
          .inquiry-top,
          .inquiry-form-section{
            width:min(100vw - 28px, 1080px);
          }

          .inquiry-top{
            margin-top:70px;
            padding-bottom:56px;
          }

          .inquiry-form-section{
            padding-top:34px;
          }

          .inquiry-copy h1{
            font-size:42px;
            letter-spacing:-.8px;
          }

          .inquiry-copy > span{
            font-size:17px;
          }

          .inquiry-form-card,
          .inquiry-guide{
            border-radius:24px;
            padding:22px;
          }

          .inquiry-fields{
            grid-template-columns:1fr;
          }

          .form-status-row{
            flex-direction:column;
          }
        }

        @media (prefers-reduced-motion: reduce){
          .load-section{
            opacity:1 !important;
            transform:none !important;
            transition:none !important;
          }

          .inquiry-submit i{
            animation:none !important;
          }
        }
      `}</style>
    </>
  );
};

export default InquiryForm;
