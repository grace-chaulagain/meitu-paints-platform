import { useMemo, useState } from "react";
import { api } from "../api/client.js";
import NavBar from "../components/NavBar.jsx";

const INITIAL_FORM = {
  name: "",
  companyName: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function GlassPanel({ children, style = {} }) {
  return (
    <div
      style={{
        borderRadius: 30,
        background: "rgba(255,255,255,.78)",
        border: "1px solid rgba(255,255,255,.68)",
        boxShadow:
          "0 24px 70px rgba(15,23,42,.08), inset 0 1px 0 rgba(255,255,255,.88)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionEyebrow({ children }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,.82)",
        border: "1px solid rgba(0,0,0,.05)",
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        color: "rgba(0,0,0,.56)",
      }}
    >
      {children}
    </div>
  );
}

function HeroMetric({ label, value, accent = false }) {
  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 20,
        background: accent ? "rgba(196,0,0,.07)" : "rgba(248,248,250,.94)",
        border: accent
          ? "1px solid rgba(196,0,0,.12)"
          : "1px solid rgba(0,0,0,.05)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,.45)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 22,
          fontWeight: 950,
          letterSpacing: "-0.03em",
          color: accent ? "#b42318" : "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FieldLabel({ children, required = false, helper = "" }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 900,
          color: "rgba(0,0,0,.5)",
          textTransform: "uppercase",
          letterSpacing: ".08em",
        }}
      >
        {children}
        {required ? (
          <span style={{ color: "#b42318", marginLeft: 4 }}>*</span>
        ) : null}
      </label>
      {helper ? (
        <div
          style={{
            marginTop: 5,
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(0,0,0,.48)",
            fontWeight: 700,
          }}
        >
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function InputField({
  value,
  onChange,
  placeholder,
  type = "text",
  textarea = false,
  rows = 5,
}) {
  const sharedStyle = {
    width: "100%",
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,.08)",
    background: "rgba(255,255,255,.96)",
    fontWeight: 700,
    outline: "none",
    color: "#0f172a",
    fontSize: 14,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,.84)",
  };

  if (textarea) {
    return (
      <textarea
        rows={rows}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          ...sharedStyle,
          minHeight: 136,
          padding: 14,
          resize: "vertical",
        }}
      />
    );
  }

  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        ...sharedStyle,
        height: 56,
        padding: "0 16px",
      }}
    />
  );
}

function FormSection({ title, subtitle, children }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 950,
            letterSpacing: "-0.02em",
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              lineHeight: 1.6,
              color: "rgba(0,0,0,.54)",
              fontWeight: 700,
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function StatusMessage({ error, success }) {
  if (!error && !success) return null;

  const isError = Boolean(error);

  return (
    <div
      style={{
        marginTop: 20,
        padding: "14px 16px",
        borderRadius: 16,
        fontWeight: 800,
        lineHeight: 1.6,
        background: isError ? "rgba(180,35,24,.08)" : "rgba(18,183,106,.10)",
        color: isError ? "#b42318" : "#067647",
        border: isError
          ? "1px solid rgba(180,35,24,.16)"
          : "1px solid rgba(18,183,106,.16)",
      }}
    >
      {error || success}
    </div>
  );
}

function ProcessStep({ index, title, description }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "34px minmax(0,1fr)",
        gap: 12,
        alignItems: "start",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: "rgba(196,0,0,.08)",
          color: "#b42318",
          fontWeight: 950,
          fontSize: 13,
        }}
      >
        {index}
      </div>

      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: "#0f172a",
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: 5,
            fontSize: 13,
            lineHeight: 1.6,
            color: "rgba(0,0,0,.58)",
            fontWeight: 700,
          }}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div
      style={{
        padding: "16px 16px",
        borderRadius: 20,
        background: "rgba(248,248,250,.92)",
        border: "1px solid rgba(0,0,0,.05)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        {title}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          lineHeight: 1.65,
          color: "rgba(0,0,0,.58)",
          fontWeight: 700,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function DispatcherRegisterPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const canSubmit = useMemo(() => {
    return (
      form.name.trim() &&
      form.companyName.trim() &&
      form.phone.trim() &&
      form.email.trim() &&
      form.address.trim() &&
      !submitting
    );
  }, [form, submitting]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      const payload = {
        name: form.name.trim(),
        companyName: form.companyName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      };

      const { data } = await api.post("/api/dispatchers/apply", payload);

      setSuccess(
        data?.message ||
          "Dispatcher application submitted successfully. After verification, your dispatcher account will be activated for assigned order operations.",
      );
      setForm(INITIAL_FORM);
    } catch (err) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Failed to submit dispatcher application.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <NavBar />

      <div
        className="dispatcher-apply-page"
        style={{
          minHeight: "100vh",
          paddingTop: 96,
          paddingBottom: 72,
          background:
            "radial-gradient(900px 520px at 12% 0%, rgba(255,230,160,.46), transparent 52%), radial-gradient(900px 520px at 88% 10%, rgba(255,120,80,.18), transparent 45%), linear-gradient(180deg, #f5f6f8 0%, #edf1f5 100%)",
        }}
      >
        <div className="container dispatcher-apply-container" style={{ maxWidth: 1440 }}>
          <GlassPanel style={{ padding: 30, marginBottom: 22 }}>
            <div
              className="dispatcher-apply-hero-grid"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.45fr) minmax(320px, .8fr)",
                gap: 24,
                alignItems: "start",
              }}
            >
              <div>
                <SectionEyebrow>Dispatcher Registration</SectionEyebrow>

                <div
                  className="dispatcher-apply-title"
                  style={{
                    marginTop: 16,
                    fontSize: 52,
                    fontWeight: 950,
                    letterSpacing: "-0.05em",
                    lineHeight: 0.98,
                    color: "#0f172a",
                    maxWidth: 760,
                  }}
                >
                  Register Your Dispatch Operation with Meitu
                </div>

                <div
                  style={{
                    marginTop: 16,
                    maxWidth: 780,
                    color: "rgba(0,0,0,.58)",
                    fontWeight: 700,
                    lineHeight: 1.7,
                    fontSize: 15,
                  }}
                >
                  Submit your operational contact details for internal review.
                  Approved dispatch partners are onboarded into Meitu’s
                  dispatcher workflow to review assigned dealer orders,
                  coordinate execution, and maintain order-level verification
                  records inside the dispatcher workspace.
                </div>
              </div>

              <div
                className="dispatcher-apply-metrics"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  alignContent: "start",
                }}
              >
                <HeroMetric label="Intake Mode" value="Application" />
                <HeroMetric label="Review" value="Admin Verified" accent />
                <HeroMetric
                  label="Portal Access"
                  value="Dispatcher Dashboard"
                />
                <HeroMetric label="Workflow" value="Assigned Orders" accent />
              </div>
            </div>
          </GlassPanel>

          <div
            className="dispatcher-apply-content-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 380px",
              gap: 22,
              alignItems: "start",
            }}
          >
            <GlassPanel style={{ padding: 26 }}>
              <form
                onSubmit={handleSubmit}
                style={{ display: "grid", gap: 28 }}
              >
                <FormSection
                  title="Primary Contact"
                  subtitle="Provide the main operational person Meitu should coordinate with during verification and future dispatcher-side order handling."
                >
                  <div
                    className="dispatcher-apply-field-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 18,
                    }}
                  >
                    <div>
                      <FieldLabel
                        required
                        helper="Full name of the contact person."
                      >
                        Contact Name
                      </FieldLabel>
                      <InputField
                        value={form.name}
                        onChange={(e) => updateField("name", e.target.value)}
                        placeholder="Enter full contact name"
                      />
                    </div>

                    <div>
                      <FieldLabel
                        required
                        helper="Registered company or dispatch service name."
                      >
                        Company Name
                      </FieldLabel>
                      <InputField
                        value={form.companyName}
                        onChange={(e) =>
                          updateField("companyName", e.target.value)
                        }
                        placeholder="Enter company or service name"
                      />
                    </div>

                    <div>
                      <FieldLabel
                        required
                        helper="Active number for coordination and verification."
                      >
                        Phone
                      </FieldLabel>
                      <InputField
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        placeholder="Enter contact number"
                      />
                    </div>

                    <div>
                      <FieldLabel
                        required
                        helper="This email will be used for approval and dispatcher account access."
                      >
                        Email
                      </FieldLabel>
                      <InputField
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>
                </FormSection>

                <div
                  style={{
                    height: 1,
                    background: "rgba(0,0,0,.06)",
                  }}
                />

                <FormSection
                  title="Operating Information"
                  subtitle="Help the admin team verify your operating base and evaluate your dispatch readiness."
                >
                  <div style={{ display: "grid", gap: 18 }}>
                    <div>
                      <FieldLabel
                        required
                        helper="Primary operating address or service base."
                      >
                        Address
                      </FieldLabel>
                      <InputField
                        value={form.address}
                        onChange={(e) => updateField("address", e.target.value)}
                        placeholder="Enter operating address"
                      />
                    </div>

                    <div>
                      <FieldLabel helper="Mention service area, route strength, delivery scope, or anything useful for admin review.">
                        Notes
                      </FieldLabel>
                      <InputField
                        textarea
                        rows={5}
                        value={form.notes}
                        onChange={(e) => updateField("notes", e.target.value)}
                        placeholder="Add delivery coverage, preferred service area, order handling notes, or additional context..."
                      />
                    </div>
                  </div>
                </FormSection>

                <StatusMessage error={error} success={success} />

                <div
                  className="dispatcher-apply-actions"
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    paddingTop: 4,
                  }}
                >
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    style={{
                      height: 58,
                      padding: "0 24px",
                      borderRadius: 18,
                      border: "1px solid rgba(196,0,0,.18)",
                      background: !canSubmit
                        ? "rgba(0,0,0,.10)"
                        : "linear-gradient(135deg, #c40000 0%, #ff5b2e 100%)",
                      color: "#fff",
                      fontWeight: 950,
                      fontSize: 15,
                      cursor: !canSubmit ? "not-allowed" : "pointer",
                      boxShadow: !canSubmit
                        ? "none"
                        : "0 18px 34px rgba(196,0,0,.24)",
                    }}
                  >
                    {submitting ? "Submitting..." : "Submit Application"}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                    style={{
                      height: 58,
                      padding: "0 22px",
                      borderRadius: 18,
                      border: "1px solid rgba(0,0,0,.08)",
                      background: "rgba(255,255,255,.96)",
                      color: "#0f172a",
                      fontWeight: 900,
                      fontSize: 15,
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    Reset Form
                  </button>
                </div>
              </form>
            </GlassPanel>

            <div
              className="dispatcher-apply-aside"
              style={{ position: "sticky", top: 100, display: "grid", gap: 18 }}
            >
              <GlassPanel style={{ padding: 22 }}>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 950,
                    letterSpacing: "-0.03em",
                    color: "#0f172a",
                  }}
                >
                  Review Flow
                </div>

                <div style={{ marginTop: 18, display: "grid", gap: 16 }}>
                  <ProcessStep
                    index={1}
                    title="Application Submitted"
                    description="Your contact and operating details are recorded in Meitu’s dispatcher intake workflow."
                  />
                  <ProcessStep
                    index={2}
                    title="Admin Verification"
                    description="Our team reviews your information internally before approving your dispatch operation."
                  />
                  <ProcessStep
                    index={3}
                    title="Dispatcher Activation"
                    description="Approved dispatchers are activated for the dispatcher dashboard and scoped to assigned dealer operations."
                  />
                  <ProcessStep
                    index={4}
                    title="Assigned Order Handling"
                    description="Once routed dealers are linked to your account, you can review, amend, verify, and reject eligible submitted orders."
                  />
                </div>
              </GlassPanel>

              <GlassPanel style={{ padding: 22 }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 950,
                    letterSpacing: "-0.02em",
                    color: "#0f172a",
                  }}
                >
                  Before You Submit
                </div>

                <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
                  <InfoCard title="Use a stable email">
                    Choose an inbox that will remain active. Verified dispatch
                    partners may later use this same email identity for
                    dispatcher-side access and order communication.
                  </InfoCard>

                  <InfoCard title="Provide accurate operating details">
                    Contact name, company name, phone number, and operating
                    address are required for verification and future
                    coordination.
                  </InfoCard>

                  <InfoCard title="Dispatcher workspace is now active">
                    Approved dispatchers are no longer limited to email-only
                    coordination. Meitu now supports a dispatcher dashboard for
                    assigned dealer and order operations.
                  </InfoCard>
                </div>
              </GlassPanel>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .dispatcher-apply-page{
          overflow-x:hidden;
        }

        .dispatcher-apply-container{
          width:min(100%, 1440px);
        }

        .dispatcher-apply-hero-grid,
        .dispatcher-apply-content-grid{
          min-width:0;
        }

        .dispatcher-apply-content-grid > *,
        .dispatcher-apply-hero-grid > *,
        .dispatcher-apply-field-grid > *{
          min-width:0;
        }

        @media (max-width: 1180px){
          .dispatcher-apply-hero-grid{
            grid-template-columns:1fr !important;
          }

          .dispatcher-apply-content-grid{
            grid-template-columns:minmax(0,1fr) !important;
          }

          .dispatcher-apply-aside{
            position:static !important;
            top:auto !important;
            grid-template-columns:repeat(2,minmax(0,1fr));
          }
        }

        @media (max-width: 820px){
          .dispatcher-apply-page{
            padding-top:84px !important;
            padding-bottom:46px !important;
          }

          .dispatcher-apply-container{
            padding-left:16px !important;
            padding-right:16px !important;
          }

          .dispatcher-apply-page [style*="border-radius: 30px"]{
            border-radius:22px !important;
          }

          .dispatcher-apply-title{
            font-size:clamp(34px, 9vw, 44px) !important;
            line-height:1.02 !important;
            letter-spacing:-0.045em !important;
          }

          .dispatcher-apply-metrics,
          .dispatcher-apply-field-grid,
          .dispatcher-apply-aside{
            grid-template-columns:1fr !important;
          }

          .dispatcher-apply-actions{
            display:grid !important;
            grid-template-columns:1fr !important;
            gap:10px !important;
          }

          .dispatcher-apply-actions button{
            width:100% !important;
            min-height:54px !important;
          }
        }

        @media (max-width: 560px){
          .dispatcher-apply-page{
            padding-top:76px !important;
            padding-bottom:34px !important;
          }

          .dispatcher-apply-container{
            padding-left:12px !important;
            padding-right:12px !important;
          }

          .dispatcher-apply-page [style*="padding: 30px"]{
            padding:18px !important;
          }

          .dispatcher-apply-page [style*="padding: 26px"]{
            padding:18px !important;
          }

          .dispatcher-apply-page [style*="padding: 22px"]{
            padding:18px !important;
          }

          .dispatcher-apply-page [style*="gap: 28px"]{
            gap:22px !important;
          }

          .dispatcher-apply-page input{
            height:52px !important;
            border-radius:15px !important;
          }

          .dispatcher-apply-page textarea{
            min-height:124px !important;
            border-radius:15px !important;
          }
        }
      `}</style>
    </>
  );
}
