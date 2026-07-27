import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
// `motion` is used via JSX (<motion.form>/<motion.div>) - this repo's eslint
// config has no react/jsx-uses-vars, so no-unused-vars can't see that usage.
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from "framer-motion";
import NavBar from "../components/NavBar";
import Toast from "../components/ui/Toast.jsx";
import RegistrationSuccessCard from "../components/ui/RegistrationSuccessCard.jsx";
import { playCompletion } from "../dealer/mobile/completionFeedback.js";
import { api, getApiErrorMessage } from "../api/client.js";

const FORM_FADE_TRANSITION = { duration: 0.22, ease: [0.23, 1, 0.32, 1] };

const initialForm = {
  companyName: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  panVat: "",
  businessType: "",
  yearsInBusiness: "",
  monthlyOrderEstimate: "",
  territory: "",
  notes: "",
  website: "",
};

const optionalFields = [
  {
    key: "businessType",
    label: "Business Type",
    hint: "Select optional type",
    type: "select",
    options: [
      "Paint shop / Hardware",
      "Building materials supplier",
      "Contractor / Applicator",
      "Distributor / Wholesaler",
      "Other",
    ],
  },
  {
    key: "panVat",
    label: "PAN / VAT",
    hint: "Optional PAN/VAT number",
  },
  {
    key: "address",
    label: "Business Address",
    hint: "City / area / full address",
  },
  {
    key: "yearsInBusiness",
    label: "Years in Business",
    hint: "Optional, e.g. 3",
  },
  {
    key: "monthlyOrderEstimate",
    label: "Monthly Order Estimate",
    hint: "Optional, e.g. 200000",
  },
  {
    key: "territory",
    label: "Preferred Territory / Area",
    hint: "Optional city, district, or area",
  },
  {
    key: "notes",
    label: "Notes",
    hint: "Optional context about your business and market",
    type: "textarea",
  },
];

// Stricter than the browser's native type="email" check (which accepts
// things like "a@b" or "a@b..c") - catches the concrete malformed patterns
// that indicate a corrupt/mistyped address rather than a real one: missing
// TLD, consecutive/leading/trailing dots, stray whitespace, multiple @
// signs, invalid characters. This is still just a format check (matching
// what the backend's Zod emailSchema enforces) - it can't confirm the
// mailbox actually exists, that's what the post-submit confirmation-link
// email is for (see /confirm-dealer-email) - but it stops obviously corrupt
// input before it ever leaves the browser.
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

export default function DealershipRegistrationPage() {
  const [formData, setFormData] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [visibleOptional, setVisibleOptional] = useState({});
  const [emailTouched, setEmailTouched] = useState(false);
  // "idle" | "checking" | "taken" - separate from format validity (emailValid
  // below); reset to "idle" whenever the email field changes so a stale
  // result never lingers against a different, not-yet-rechecked address.
  const [emailAvailability, setEmailAvailability] = useState("idle");
  const [toastOpen, setToastOpen] = useState(false);

  const emailValid = useMemo(() => isValidEmail(formData.email), [formData.email]);
  const showEmailError =
    emailTouched &&
    formData.email.trim().length > 0 &&
    (!emailValid || emailAvailability === "taken");

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
    if (event.target.name === "email") {
      setEmailAvailability("idle");
    }
  };

  // Backend source of truth is applyForDealership's own User.findOne gate -
  // this only queries the lightweight check-email endpoint, so it's purely
  // an early-feedback layer, not the real enforcement. Fails open (leaves
  // availability as "idle") on a network hiccup rather than blocking the
  // field on something that isn't actually the applicant's fault; the real
  // gate still runs again at submit time regardless.
  async function checkEmailAvailable(email) {
    try {
      const { data } = await api.get("/api/dealer/check-email", { params: { email } });
      return data?.available !== false;
    } catch {
      return true;
    }
  }

  const handleEmailBlur = async () => {
    setEmailTouched(true);
    if (!isValidEmail(formData.email)) return;

    setEmailAvailability("checking");
    const available = await checkEmailAvailable(formData.email);
    setEmailAvailability(available ? "idle" : "taken");
  };

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

  function triggerSuccess() {
    setSubmitted(true);
    setFormData(initialForm);
    setVisibleOptional({});
    setToastOpen(true);
    playCompletion();
  }

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

    // Always re-checked fresh here regardless of what the blur-triggered
    // check already found - covers Enter-to-submit (blur may never have
    // fired) and edits made after the last blur. applyForDealership's own
    // User.findOne gate is still the real enforcement; this just avoids a
    // pointless round-trip through the whole submit flow for an email that's
    // already known to be taken.
    setEmailAvailability("checking");
    const available = await checkEmailAvailable(formData.email);
    if (!available) {
      setEmailAvailability("taken");
      setEmailTouched(true);
      return;
    }
    setEmailAvailability("idle");

    setSubmitting(true);
    setSubmitted(false);
    setError("");

    try {
      if (formData.website) {
        triggerSuccess();
        return;
      }

      const extraLines = [
        formData.businessType ? `Business type: ${formData.businessType}` : "",
        formData.yearsInBusiness
          ? `Years in business: ${formData.yearsInBusiness}`
          : "",
        formData.monthlyOrderEstimate
          ? `Estimated monthly order (NPR): ${formData.monthlyOrderEstimate}`
          : "",
        formData.territory
          ? `Preferred territory/area: ${formData.territory}`
          : "",
      ].filter(Boolean);

      const compiledNotes = [
        (formData.notes || "").trim(),
        extraLines.length ? `\n\n---\n${extraLines.join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("");

      await api.post("/api/dealer/apply", {
        companyName: formData.companyName,
        contactName: formData.contactName,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        panVat: formData.panVat,
        notes: compiledNotes,
      });

      triggerSuccess();
    } catch (err) {
      setError(getApiErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const renderOptionalField = (field) => (
    <label
      key={field.key}
      className={`apple-dealer-field ${
        field.type === "textarea" ? "full" : ""
      }`}
    >
      <span className="apple-dealer-field-head">
        <span>{field.label}</span>
        <button type="button" onClick={() => hideOptional(field.key)}>
          Remove
        </button>
      </span>
      {field.type === "select" ? (
        <select
          name={field.key}
          value={formData[field.key]}
          onChange={handleChange}
        >
          <option value="">{field.hint}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
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

      <main className="apple-dealer-register-page">
        <section className="apple-dealer-register-shell">
          <div className="apple-dealer-copy">
            <Link to="/dealership" className="apple-dealer-back">
              <span>
                <BackArrowIcon />
              </span>
              Back to dealership
            </Link>
            <div className="apple-dealer-kicker">Dealer Registration</div>
            <h1>Start with the essentials.</h1>
            <p>
              Submit the minimum details first. Add business information only
              when it helps our team verify your application faster.
            </p>
          </div>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={FORM_FADE_TRANSITION}
              >
                <RegistrationSuccessCard message="Application received. Check your inbox for a confirmation email — click the link to confirm your email before we can review your application." />
              </motion.div>
            ) : (
              <motion.form
                key="form"
                className="apple-dealer-card"
                onSubmit={handleSubmit}
                initial={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={FORM_FADE_TRANSITION}
              >
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  className="apple-dealer-honeypot"
                  tabIndex={-1}
                  autoComplete="off"
                />

                {submitting ? (
                  <div className="apple-dealer-loading" role="status">
                    <svg className="apple-dealer-spinner-ring" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                      <circle cx="10" cy="10" r="8" fill="none" stroke="#e8e8ed" strokeWidth="2" />
                      <circle cx="10" cy="10" r="8" fill="none" stroke="#1d1d1f" strokeWidth="2" strokeLinecap="round" strokeDasharray="34 50" />
                    </svg>
                    <span>Sending application to Meitu...</span>
                  </div>
                ) : null}

                {error ? (
                  <div className="apple-dealer-alert" role="alert">
                    {error}
                  </div>
                ) : null}

            <div className="apple-dealer-core-fields">
              <label className="apple-dealer-field">
                <span>Contact Person</span>
                <input
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  required
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </label>

              <label className={`apple-dealer-field ${showEmailError ? "invalid" : ""}`}>
                <span className="apple-dealer-field-head">
                  <span>Email Address</span>
                  {emailAvailability === "checking" ? (
                    <span className="apple-dealer-field-checking">
                      <span className="apple-dealer-field-checking-dot" aria-hidden="true" />
                      Checking…
                    </span>
                  ) : null}
                </span>
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
                  <span className="apple-dealer-field-error">
                    {!emailValid
                      ? "Enter a valid email address, e.g. name@example.com"
                      : "This email is already registered. Please use a different email or sign in instead."}
                  </span>
                ) : null}
              </label>

              <label className="apple-dealer-field">
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

              <label className="apple-dealer-field">
                <span>Company Name</span>
                <input
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  required
                  placeholder="Business / shop name"
                  autoComplete="organization"
                />
              </label>
            </div>

            <div className="apple-dealer-optional">
              <div className="apple-dealer-optional-head">
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
                <div className="apple-dealer-add-grid">
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
                <div className="apple-dealer-extra-fields">
                  {activeOptionalFields.map(renderOptionalField)}
                </div>
              ) : null}
            </div>

            <div className="apple-dealer-actions">
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit request"}
              </button>
              <p>
                After verification, Meitu will email a secure password setup
                link.
              </p>
            </div>
              </motion.form>
            )}
          </AnimatePresence>
        </section>
      </main>

      <Toast open={toastOpen} message="Application submitted!" onDismiss={() => setToastOpen(false)} />

      <style>{`
        .apple-dealer-register-page{
          min-height:calc(100vh - 44px);
          padding:96px 20px 64px;
          background:#f5f5f7;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
        }

        .apple-dealer-register-shell{
          width:min(1080px, 100%);
          margin:0 auto;
          display:grid;
          grid-template-columns:minmax(0, .9fr) minmax(0, 1.1fr);
          gap:44px;
          align-items:start;
        }

        .apple-dealer-copy{
          position:sticky;
          top:84px;
          padding-top:8px;
        }

        .apple-dealer-back{
          display:inline-flex;
          align-items:center;
          gap:8px;
          color:#0066cc;
          text-decoration:none;
          font-size:14px;
          line-height:1;
          margin-bottom:30px;
        }

        .apple-dealer-back span{
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

        .apple-dealer-back:hover{
          text-decoration:none;
        }

        .apple-dealer-back:hover span{
          background:#e8e8ed;
          transform:translateX(-1px);
        }

        .apple-dealer-kicker{
          color:#707070;
          font-size:17px;
          line-height:1.3;
          font-weight:600;
          letter-spacing:-.006em;
        }

        .apple-dealer-copy h1{
          margin:10px 0 0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif);
          font-size:clamp(48px, 7vw, 72px);
          line-height:1.04;
          font-weight:700;
          letter-spacing:-.022em;
        }

        .apple-dealer-copy p{
          width:min(100%, 420px);
          margin:18px 0 0;
          color:#707070;
          font-size:20px;
          line-height:1.42;
          font-weight:300;
          letter-spacing:-.01em;
        }

        .apple-dealer-card{
          border-radius:28px;
          background:#fff;
          border:1px solid #e8e8ed;
          padding:28px;
        }

        .apple-dealer-honeypot{
          position:absolute;
          left:-10000px;
          width:1px;
          height:1px;
          opacity:0;
        }

        .apple-dealer-alert{
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

        .apple-dealer-loading{
          margin:0 0 16px;
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
          animation:appleDealerLoadingIn .24s ease both;
        }

        .apple-dealer-spinner-ring{
          flex:0 0 auto;
          animation:appleDealerSpin .85s linear infinite;
        }

        .apple-dealer-field-checking{
          display:inline-flex;
          align-items:center;
          gap:6px;
          color:#0071e3;
          font-size:11px;
          font-weight:600;
          text-transform:none;
          letter-spacing:0;
        }

        .apple-dealer-field-checking-dot{
          width:5px;
          height:5px;
          border-radius:999px;
          background:#0071e3;
          animation:appleDealerPulse 1s ease-in-out infinite;
        }

        @keyframes appleDealerSpin{
          to{ transform:rotate(360deg); }
        }

        @keyframes appleDealerLoadingIn{
          from{ opacity:0; transform:translateY(-4px); }
          to{ opacity:1; transform:translateY(0); }
        }

        @keyframes appleDealerPulse{
          0%, 100%{ opacity:.35; transform:scale(.85); }
          50%{ opacity:1; transform:scale(1); }
        }

        .apple-dealer-core-fields,
        .apple-dealer-extra-fields{
          display:grid;
          grid-template-columns:repeat(2, minmax(0, 1fr));
          gap:12px;
        }

        .apple-dealer-field{
          display:grid;
          gap:8px;
        }

        .apple-dealer-field.full{
          grid-column:1 / -1;
        }

        .apple-dealer-field span,
        .apple-dealer-field-head{
          color:#707070;
          font-size:12px;
          line-height:1.2;
          font-weight:600;
          letter-spacing:-.003em;
        }

        .apple-dealer-field-head{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
        }

        .apple-dealer-field-head button{
          border:0;
          background:transparent;
          color:#0066cc;
          padding:0;
          font-size:12px;
          cursor:pointer;
        }

        .apple-dealer-field input,
        .apple-dealer-field select,
        .apple-dealer-field textarea{
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

        .apple-dealer-field input,
        .apple-dealer-field select{
          height:48px;
          padding:0 13px;
        }

        .apple-dealer-field textarea{
          padding:13px;
          resize:vertical;
          min-height:108px;
        }

        .apple-dealer-field input:focus,
        .apple-dealer-field select:focus,
        .apple-dealer-field textarea:focus{
          border-color:#86868b !important;
          box-shadow:none !important;
        }

        .apple-dealer-field.invalid input{
          border-color:#b64400 !important;
        }

        .apple-dealer-field.invalid input:focus{
          border-color:#b64400 !important;
        }

        .apple-dealer-field-error{
          /* !important: ".apple-dealer-field span" (the grey label style
             above) is a class+element selector, which beats this
             single-class one on specificity alone - without it the error
             text would silently render in the same grey as a normal field
             label instead of reading as a warning. */
          color:#b64400 !important;
          font-size:12px;
          line-height:1.4;
          font-weight:500;
          letter-spacing:-.003em;
        }

        .apple-dealer-field input:-webkit-autofill,
        .apple-dealer-field input:-webkit-autofill:hover,
        .apple-dealer-field input:-webkit-autofill:focus,
        .apple-dealer-field input:-webkit-autofill:active{
          -webkit-text-fill-color:#1d1d1f !important;
          caret-color:#1d1d1f !important;
          box-shadow:0 0 0 1000px #fff inset !important;
          -webkit-box-shadow:0 0 0 1000px #fff inset !important;
          transition:background-color 9999s ease-in-out 0s !important;
        }

        .apple-dealer-field input::selection,
        .apple-dealer-field textarea::selection{
          background:transparent;
          color:#1d1d1f;
        }

        .apple-dealer-optional{
          margin-top:24px;
          padding-top:22px;
          border-top:1px solid #e8e8ed;
        }

        .apple-dealer-optional-head{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
        }

        .apple-dealer-optional-head h2{
          margin:0;
          color:#1d1d1f;
          font-size:22px;
          line-height:1.15;
          font-weight:600;
          letter-spacing:-.015em;
        }

        .apple-dealer-optional-head p{
          margin:5px 0 0;
          color:#707070;
          font-size:14px;
          line-height:1.4;
        }

        .apple-dealer-optional-head button{
          min-height:32px;
          border:0;
          border-radius:999px;
          padding:0 12px;
          background:#f5f5f7;
          color:#1d1d1f;
          font-size:13px;
          cursor:pointer;
        }

        .apple-dealer-add-grid{
          margin-top:14px;
          display:flex;
          flex-wrap:wrap;
          gap:8px;
        }

        .apple-dealer-add-grid button{
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

        .apple-dealer-add-grid button span{
          color:#0066cc;
          font-size:16px;
          line-height:1;
        }

        .apple-dealer-extra-fields{
          margin-top:16px;
        }

        .apple-dealer-actions{
          margin-top:26px;
          display:grid;
          gap:12px;
          justify-items:start;
        }

        .apple-dealer-actions button{
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

        .apple-dealer-actions button:disabled{
          opacity:.54;
          cursor:not-allowed;
          background:#86868b;
        }

        .apple-dealer-actions p{
          margin:0;
          color:#707070;
          font-size:12px;
          line-height:1.45;
        }

        @media (max-width:900px){
          .apple-dealer-register-page{
            padding:76px 16px 42px;
          }

          .apple-dealer-register-shell{
            grid-template-columns:1fr;
            gap:28px;
          }

          .apple-dealer-copy{
            position:static;
            text-align:center;
          }

          .apple-dealer-copy p{
            margin-left:auto;
            margin-right:auto;
          }

          .apple-dealer-back{
            margin-bottom:18px;
          }
        }

        @media (max-width:640px){
          .apple-dealer-card{
            border-radius:24px;
            padding:18px;
          }

          .apple-dealer-core-fields,
          .apple-dealer-extra-fields{
            grid-template-columns:1fr;
          }

          .apple-dealer-optional-head{
            display:grid;
          }

          .apple-dealer-copy h1{
            font-size:44px;
          }
        }
      `}</style>
    </>
  );
}
