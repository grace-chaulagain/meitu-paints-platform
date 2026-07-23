import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar.jsx";
import { api, getApiErrorMessage } from "../api/client.js";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  companyName: "",
  address: "",
  notes: "",
  website: "",
};

const optionalFields = [
  {
    key: "address",
    label: "Operating Address",
    hint: "City / area / full address",
  },
  {
    key: "notes",
    label: "Notes",
    hint: "Optional context - service area, route strength, delivery scope",
    type: "textarea",
  },
];

// Mirrors DealershipRegistration.jsx's isValidEmail exactly - stricter than
// the browser's native type="email" check (which accepts things like "a@b"
// or "a@b..c"), catches the concrete malformed patterns that indicate a
// corrupt/mistyped address: missing TLD, consecutive/leading/trailing dots,
// stray whitespace, multiple @ signs, invalid characters. Still just a
// format check (matching what the backend's Zod emailSchema enforces) - it
// stops obviously corrupt input before it ever leaves the browser.
function isValidEmail(value) {
  const email = String(value || "").trim();
  if (!email || /\s/.test(email) || /\.\./.test(email)) return false;

  const match = email.match(/^([^@]+)@([^@]+)$/);
  if (!match) return false;
  const [, local, domain] = match;

  if (!local || local.startsWith(".") || local.endsWith(".")) return false;
  if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;

  if (!domain || domain.startsWith(".") || domain.endsWith(".") || domain.startsWith("-") || domain.endsWith("-")) {
    return false;
  }
  if (!/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+$/.test(domain)) return false;

  const tld = domain.split(".").pop();
  return /^[a-zA-Z]{2,}$/.test(tld);
}

function BackArrowIcon() {
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
      <path d="M15 6 9 12l6 6" />
    </svg>
  );
}

export default function DispatcherRegisterPage() {
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [visibleOptional, setVisibleOptional] = useState({});
  const [emailTouched, setEmailTouched] = useState(false);

  const emailValid = useMemo(() => isValidEmail(formData.email), [formData.email]);
  const showEmailError = emailTouched && formData.email.trim().length > 0 && !emailValid;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, []);

  const hiddenOptionalFields = useMemo(
    () => optionalFields.filter((field) => !visibleOptional[field.key]),
    [visibleOptional],
  );

  const activeOptionalFields = useMemo(
    () => optionalFields.filter((field) => visibleOptional[field.key]),
    [visibleOptional],
  );

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleEmailBlur = () => setEmailTouched(true);

  const showOptional = (key) => {
    setVisibleOptional((current) => ({ ...current, [key]: true }));
  };

  const hideOptional = (key) => {
    setVisibleOptional((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormData((current) => ({ ...current, [key]: "" }));
  };

  const showAllOptional = () => {
    setVisibleOptional(
      optionalFields.reduce((acc, field) => ({ ...acc, [field.key]: true }), {}),
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    // Belt-and-suspenders: catches a bad address even if the field was never
    // blurred (paste-then-submit) or the browser's native type="email" check
    // let something looser through.
    if (!isValidEmail(formData.email)) {
      setEmailTouched(true);
      setError("Please enter a valid email address before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitted(false);
    setError("");

    try {
      if (formData.website) {
        setSubmitted(true);
        setFormData(initialForm);
        setVisibleOptional({});
        return;
      }

      await api.post("/api/dispatchers/apply", {
        name: formData.name.trim(),
        companyName: formData.companyName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim().toLowerCase(),
        address: formData.address.trim(),
        notes: formData.notes.trim(),
      });

      setSubmitted(true);
      setFormData(initialForm);
      setVisibleOptional({});
    } catch (err) {
      setError(getApiErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const renderOptionalField = (field) => (
    <label
      key={field.key}
      className={`apple-dispatcher-field ${
        field.type === "textarea" ? "full" : ""
      }`}
    >
      <span className="apple-dispatcher-field-head">
        <span>{field.label}</span>
        <button type="button" onClick={() => hideOptional(field.key)}>
          Remove
        </button>
      </span>
      {field.type === "textarea" ? (
        <textarea
          rows="4"
          name={field.key}
          value={formData[field.key]}
          onChange={handleChange}
          placeholder={field.hint}
        />
      ) : (
        <input
          name={field.key}
          value={formData[field.key]}
          onChange={handleChange}
          placeholder={field.hint}
        />
      )}
    </label>
  );

  return (
    <>
      <NavBar />

      <main className="apple-dispatcher-register-page">
        <section className="apple-dispatcher-register-shell">
          <div className="apple-dispatcher-copy">
            <Link to="/login" className="apple-dispatcher-back">
              <span>
                <BackArrowIcon />
              </span>
              Back to sign in
            </Link>
            <div className="apple-dispatcher-kicker">Dispatcher Registration</div>
            <h1>Dispatch for Meitu.</h1>
            <p>
              Submit the minimum details first. Add operating information only
              when it helps our team verify your application faster.
            </p>
          </div>

          <form className="apple-dispatcher-card" onSubmit={handleSubmit}>
            <input
              type="text"
              name="website"
              value={formData.website}
              onChange={handleChange}
              className="apple-dispatcher-honeypot"
              tabIndex={-1}
              autoComplete="off"
            />

            <div className="apple-dispatcher-status-row" aria-live="polite">
              <span className="apple-dispatcher-status">
                {submitting ? "Submitting" : submitted ? "Submitted" : "Ready"}
              </span>
              {submitted ? (
                <span className="apple-dispatcher-success">
                  Application received. Check your email after admin review.
                </span>
              ) : null}
            </div>

            {submitting ? (
              <div className="apple-dispatcher-loading" role="status">
                <span className="apple-dispatcher-spinner" aria-hidden="true" />
                <span>Sending application to Meitu...</span>
              </div>
            ) : null}

            {error ? (
              <div className="apple-dispatcher-alert" role="alert">
                {error}
              </div>
            ) : null}

            <div className="apple-dispatcher-core-fields">
              <label className="apple-dispatcher-field">
                <span>Contact Person</span>
                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </label>

              <label className={`apple-dispatcher-field ${showEmailError ? "invalid" : ""}`}>
                <span>Email Address</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleEmailBlur}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  aria-invalid={showEmailError}
                />
                {showEmailError ? (
                  <span className="apple-dispatcher-field-error">
                    Enter a valid email address, e.g. name@example.com
                  </span>
                ) : null}
              </label>

              <label className="apple-dispatcher-field">
                <span>Phone Number</span>
                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  placeholder="98XXXXXXXX"
                  autoComplete="tel"
                />
              </label>

              <label className="apple-dispatcher-field">
                <span>Company Name</span>
                <input
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  placeholder="Registered company or dispatch service name"
                  autoComplete="organization"
                />
              </label>
            </div>

            <div className="apple-dispatcher-optional">
              <div className="apple-dispatcher-optional-head">
                <div>
                  <h2>Optional details</h2>
                  <p>Add only what you want to share right now.</p>
                </div>
                {hiddenOptionalFields.length ? (
                  <button type="button" onClick={showAllOptional}>
                    Add all
                  </button>
                ) : null}
              </div>

              {hiddenOptionalFields.length ? (
                <div className="apple-dispatcher-add-grid">
                  {hiddenOptionalFields.map((field) => (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() => showOptional(field.key)}
                    >
                      <span>+</span>
                      {field.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {activeOptionalFields.length ? (
                <div className="apple-dispatcher-extra-fields">
                  {activeOptionalFields.map(renderOptionalField)}
                </div>
              ) : null}
            </div>

            <div className="apple-dispatcher-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit request"}
              </button>
              <p>
                After verification, Meitu will email a secure password setup
                link.
              </p>
            </div>
          </form>
        </section>
      </main>

      <style>{`
        .apple-dispatcher-register-page{
          min-height:calc(100vh - 44px);
          padding:96px 20px 64px;
          background:#f5f5f7;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
        }

        .apple-dispatcher-register-shell{
          width:min(1080px, 100%);
          margin:0 auto;
          display:grid;
          grid-template-columns:minmax(0, .9fr) minmax(0, 1.1fr);
          gap:44px;
          align-items:start;
        }

        .apple-dispatcher-copy{
          position:sticky;
          top:84px;
          padding-top:8px;
        }

        .apple-dispatcher-back{
          display:inline-flex;
          align-items:center;
          gap:8px;
          color:#0066cc;
          text-decoration:none;
          font-size:14px;
          line-height:1;
          margin-bottom:30px;
        }

        .apple-dispatcher-back span{
          width:30px;
          height:30px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          background:#fff;
          border:1px solid #e8e8ed;
          color:#1d1d1f;
          transition:background-color .1s ease, transform .1s ease;
        }

        .apple-dispatcher-back:hover{
          text-decoration:none;
        }

        .apple-dispatcher-back:hover span{
          background:#e8e8ed;
          transform:translateX(-1px);
        }

        .apple-dispatcher-kicker{
          color:#707070;
          font-size:17px;
          line-height:1.3;
          font-weight:600;
          letter-spacing:-.006em;
        }

        .apple-dispatcher-copy h1{
          margin:10px 0 0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
          font-size:clamp(48px, 7vw, 72px);
          line-height:1.04;
          font-weight:700;
          letter-spacing:-.022em;
        }

        .apple-dispatcher-copy p{
          width:min(100%, 420px);
          margin:18px 0 0;
          color:#707070;
          font-size:20px;
          line-height:1.42;
          font-weight:300;
          letter-spacing:-.01em;
        }

        .apple-dispatcher-card{
          border-radius:28px;
          background:#fff;
          border:1px solid #e8e8ed;
          padding:28px;
        }

        .apple-dispatcher-honeypot{
          position:absolute;
          left:-10000px;
          width:1px;
          height:1px;
          opacity:0;
        }

        .apple-dispatcher-status-row{
          min-height:32px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          margin-bottom:20px;
        }

        .apple-dispatcher-status{
          display:inline-flex;
          align-items:center;
          min-height:28px;
          padding:0 11px;
          border-radius:999px;
          background:#f5f5f7;
          border:1px solid #e8e8ed;
          color:#707070;
          font-size:12px;
          font-weight:600;
        }

        .apple-dispatcher-success{
          color:#1d1d1f;
          font-size:13px;
          line-height:1.35;
        }

        .apple-dispatcher-alert{
          margin-bottom:16px;
          border-radius:16px;
          padding:12px 14px;
          background:rgba(182,68,0,.08);
          border:1px solid rgba(182,68,0,.18);
          color:#b64400;
          font-size:13px;
          line-height:1.45;
          font-weight:500;
        }

        .apple-dispatcher-loading{
          margin:-4px 0 16px;
          min-height:44px;
          border-radius:18px;
          background:#f5f5f7;
          border:1px solid #e8e8ed;
          color:#474747;
          display:flex;
          align-items:center;
          gap:12px;
          padding:0 14px;
          font-size:13px;
          line-height:1.3;
          font-weight:500;
          animation:appleDispatcherLoadingIn .24s ease both;
        }

        .apple-dispatcher-spinner{
          width:18px;
          height:18px;
          border-radius:999px;
          border:2px solid #d2d2d7;
          border-top-color:#1d1d1f;
          animation:appleDispatcherSpin .72s linear infinite;
          flex:0 0 auto;
        }

        @keyframes appleDispatcherSpin{
          to{ transform:rotate(360deg); }
        }

        @keyframes appleDispatcherLoadingIn{
          from{ opacity:0; transform:translateY(-4px); }
          to{ opacity:1; transform:translateY(0); }
        }

        .apple-dispatcher-core-fields,
        .apple-dispatcher-extra-fields{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:12px;
        }

        .apple-dispatcher-field{
          display:grid;
          gap:8px;
        }

        .apple-dispatcher-field.full{
          grid-column:1 / -1;
        }

        .apple-dispatcher-field span,
        .apple-dispatcher-field-head{
          color:#707070;
          font-size:12px;
          line-height:1.2;
          font-weight:600;
          letter-spacing:-.003em;
        }

        .apple-dispatcher-field-head{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        }

        .apple-dispatcher-field-head button{
          border:0;
          background:transparent;
          color:#0066cc;
          padding:0;
          font-size:12px;
          cursor:pointer;
        }

        .apple-dispatcher-field input,
        .apple-dispatcher-field textarea{
          width:100%;
          border:1px solid #d2d2d7 !important;
          border-radius:16px !important;
          background:#fff !important;
          color:#1d1d1f;
          outline:0 !important;
          box-shadow:none !important;
          appearance:none;
          -webkit-appearance:none;
          font-size:15px;
          line-height:1.35;
          font-weight:400;
          letter-spacing:-.006em;
          transition:border-color .16s ease, background-color .16s ease;
        }

        .apple-dispatcher-field input{
          height:48px;
          padding:0 13px;
        }

        .apple-dispatcher-field textarea{
          padding:13px;
          resize:vertical;
          min-height:108px;
        }

        .apple-dispatcher-field input:focus,
        .apple-dispatcher-field textarea:focus{
          border-color:#86868b !important;
          box-shadow:none !important;
        }

        .apple-dispatcher-field.invalid input{
          border-color:#b64400 !important;
        }

        .apple-dispatcher-field.invalid input:focus{
          border-color:#b64400 !important;
        }

        .apple-dispatcher-field-error{
          /* !important: ".apple-dispatcher-field span" (the grey label
             style two rules up) is a class+element selector, which beats
             this single-class one on specificity alone - without it the
             error text would silently render in the same grey as a normal
             field label instead of reading as a warning. */
          color:#b64400 !important;
          font-size:12px;
          line-height:1.4;
          font-weight:500;
          letter-spacing:-.003em;
        }

        .apple-dispatcher-field input:-webkit-autofill,
        .apple-dispatcher-field input:-webkit-autofill:hover,
        .apple-dispatcher-field input:-webkit-autofill:focus,
        .apple-dispatcher-field input:-webkit-autofill:active{
          -webkit-text-fill-color:#1d1d1f !important;
          caret-color:#1d1d1f !important;
          box-shadow:0 0 0 1000px #fff inset !important;
          -webkit-box-shadow:0 0 0 1000px #fff inset !important;
          transition:background-color 9999s ease-in-out 0s !important;
        }

        .apple-dispatcher-field input::selection,
        .apple-dispatcher-field textarea::selection{
          background:transparent;
          color:#1d1d1f;
        }

        .apple-dispatcher-optional{
          margin-top:24px;
          padding-top:22px;
          border-top:1px solid #e8e8ed;
        }

        .apple-dispatcher-optional-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
        }

        .apple-dispatcher-optional-head h2{
          margin:0;
          color:#1d1d1f;
          font-size:22px;
          line-height:1.15;
          font-weight:600;
          letter-spacing:-.015em;
        }

        .apple-dispatcher-optional-head p{
          margin:5px 0 0;
          color:#707070;
          font-size:14px;
          line-height:1.4;
        }

        .apple-dispatcher-optional-head button{
          min-height:32px;
          border:0;
          border-radius:999px;
          padding:0 12px;
          background:#f5f5f7;
          color:#1d1d1f;
          font-size:13px;
          cursor:pointer;
        }

        .apple-dispatcher-add-grid{
          margin-top:14px;
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }

        .apple-dispatcher-add-grid button{
          min-height:34px;
          border:1px solid #e8e8ed;
          border-radius:999px;
          padding:0 12px;
          background:#fff;
          color:#1d1d1f;
          display:inline-flex;
          align-items:center;
          gap:7px;
          font-size:13px;
          cursor:pointer;
        }

        .apple-dispatcher-add-grid button span{
          color:#0066cc;
          font-size:16px;
          line-height:1;
        }

        .apple-dispatcher-extra-fields{
          margin-top:16px;
        }

        .apple-dispatcher-actions{
          margin-top:26px;
          display:grid;
          gap:12px;
          justify-items:start;
        }

        .apple-dispatcher-actions button{
          min-height:42px;
          border:0;
          border-radius:999px;
          padding:0 18px;
          background:#0071e3;
          color:#fff;
          font-size:17px;
          line-height:1;
          font-weight:400;
          cursor:pointer;
        }

        .apple-dispatcher-actions button:disabled{
          opacity:.54;
          cursor:not-allowed;
          background:#86868b;
        }

        .apple-dispatcher-actions p{
          margin:0;
          color:#707070;
          font-size:12px;
          line-height:1.45;
        }

        @media (max-width:900px){
          .apple-dispatcher-register-page{
            padding:76px 16px 42px;
          }

          .apple-dispatcher-register-shell{
            grid-template-columns:1fr;
            gap:28px;
          }

          .apple-dispatcher-copy{
            position:static;
            text-align:center;
          }

          .apple-dispatcher-copy p{
            margin-left:auto;
            margin-right:auto;
          }

          .apple-dispatcher-back{
            margin-bottom:18px;
          }
        }

        @media (max-width:640px){
          .apple-dispatcher-card{
            border-radius:24px;
            padding:18px;
          }

          .apple-dispatcher-core-fields,
          .apple-dispatcher-extra-fields{
            grid-template-columns:1fr;
          }

          .apple-dispatcher-status-row,
          .apple-dispatcher-optional-head{
            display:grid;
          }

          .apple-dispatcher-copy h1{
            font-size:44px;
          }
        }
      `}</style>
    </>
  );
}
