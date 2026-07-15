// src/pages/NotFoundPage.jsx (or wherever yours lives)
import React, { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";

function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Always start at top (works across devices)
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.key]);

  // Show a clean “requested path” (no query noise)
  const requested = useMemo(() => {
    const p = location?.pathname || "/";
    return p.length > 42 ? p.slice(0, 42) + "…" : p;
  }, [location.pathname]);

  return (
    <>
      <NavBar />

      <main className="nf-root" aria-label="Page not found">
        <section className="nf-shell">
          <div className="nf-card">
            <div className="nf-status" aria-hidden="true">
              <span />
            </div>
            <div className="nf-kicker">ERROR 404</div>
            <h1 className="nf-title">This page doesn't exist.</h1>
            <p className="nf-sub">
              The link may be broken, or the page may have moved. Your session
              is still active.
            </p>

            <div className="nf-path" title={location.pathname}>
              <span className="nf-path-label">Requested</span>
              <span className="nf-path-value">{requested}</span>
            </div>

            <div className="nf-actions">
              <button
                type="button"
                className="nf-btn primary"
                onClick={() => navigate("/")}
              >
                Home
                <span aria-hidden="true">›</span>
              </button>

              <button
                type="button"
                className="nf-btn secondary"
                onClick={() => navigate(-1)}
              >
                Back
              </button>

              <Link className="nf-btn text" to="/products">
                Products
              </Link>
            </div>

            <nav className="nf-links" aria-label="Helpful destinations">
              <Link to="/colors">
                <span>Colors</span>
                <span aria-hidden="true">›</span>
              </Link>
              <Link to="/textures">
                <span>Textures</span>
                <span aria-hidden="true">›</span>
              </Link>
              <Link to="/ratecalculator">
                <span>Estimator</span>
                <span aria-hidden="true">›</span>
              </Link>
              <Link to="/support">
                <span>Support</span>
                <span aria-hidden="true">›</span>
              </Link>
            </nav>
          </div>

          <div className="nf-orbit" aria-hidden="true">
            <div className="nf-orbit-card">
              <div className="nf-orbit-top">
                <span />
                <span />
                <span />
              </div>
              <div className="nf-orbit-number">404</div>
              <div className="nf-orbit-line" />
              <div className="nf-orbit-row">
                <span>Route</span>
                <strong>Not found</strong>
              </div>
              <div className="nf-orbit-row">
                <span>Session</span>
                <strong>Safe</strong>
              </div>
            </div>
          </div>
        </section>
      </main>
      <style>{`
        .nf-root{
          min-height: 100vh;
          background:
            radial-gradient(900px 480px at 50% 0%, rgba(0,113,227,.07), transparent 62%),
            var(--color-fog, #f5f5f7);
          color: var(--color-ink, #1d1d1f);
          font-family: var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif);
          padding: 112px 24px 56px;
        }

        .nf-shell{
          width: min(1040px, 100%);
          margin: 0 auto;
          position: relative;
          align-items:center;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          gap: 22px;
        }

        .nf-card{
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          border-radius: 28px;
          background: var(--color-snow, #ffffff);
          box-shadow: none;
          padding: clamp(28px, 5vw, 46px);
          min-height: 470px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .nf-status{
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: var(--color-fog, #f5f5f7);
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          margin-bottom: 22px;
        }

        .nf-status span{
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--color-ink, #1d1d1f);
          position: relative;
        }

        .nf-status span::after{
          content: "";
          position: absolute;
          width: 2px;
          height: 8px;
          left: 50%;
          top: 4px;
          transform: translateX(-50%);
          background: var(--color-ink, #1d1d1f);
          border-radius: 2px;
        }

        .nf-kicker{
          margin: 0 0 10px;
          font-size: 12px;
          line-height: 1.33;
          letter-spacing: -0.26px;
          font-weight: 600;
          color: var(--color-graphite, #707070);
        }

        .nf-title{
          margin: 0;
          max-width: 640px;
          font-family: var(--font-sf-pro-display, Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif);
          font-size: clamp(44px, 7vw, 72px);
          line-height: .98;
          letter-spacing: -0.055em;
          font-weight: 700;
          color: var(--color-ink, #1d1d1f);
        }

        .nf-sub{
          margin: 18px 0 0;
          max-width: 560px;
          font-size: 17px;
          line-height: 1.47;
          letter-spacing: -0.1px;
          font-weight: 400;
          color: var(--color-graphite, #707070);
        }

        .nf-path{
          width: min(460px, 100%);
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 14px;
          border-radius: 18px;
          background: var(--color-fog, #f5f5f7);
          border: 1px solid var(--color-silver-mist, #e8e8ed);
        }

        .nf-path-label{
          font-size: 12px;
          line-height: 1.33;
          font-weight: 600;
          color: var(--color-graphite, #707070);
          white-space: nowrap;
        }

        .nf-path-value{
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          line-height: 1.43;
          font-weight: 500;
          color: var(--color-ink, #1d1d1f);
          text-align: right;
        }

        .nf-actions{
          margin-top: 24px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .nf-btn{
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          border-radius: 999px;
          border: 1px solid transparent;
          padding: 0 18px;
          font-size: 17px;
          line-height: 1;
          letter-spacing: -0.1px;
          font-weight: 400;
          text-decoration: none;
          cursor: pointer;
          transition: opacity .1s ease, background-color .1s ease, border-color .1s ease, transform .1s ease;
        }

        .nf-btn:hover{
          transform: translateY(-1px);
        }

        .nf-btn.primary{
          background: var(--color-azure, #0071e3);
          color: #fff;
        }

        .nf-btn.secondary{
          background: var(--color-fog, #f5f5f7);
          border-color: var(--color-silver-mist, #e8e8ed);
          color: var(--color-ink, #1d1d1f);
        }

        .nf-btn.text{
          padding-inline: 4px;
          background: transparent;
          color: var(--color-cobalt-link, #0066cc);
        }

        .nf-links{
          margin-top: 32px;
          padding-top: 18px;
          border-top: 1px solid var(--color-silver-mist, #e8e8ed);
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }

        .nf-links a{
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-radius: 18px;
          padding: 12px 14px;
          background: var(--color-fog, #f5f5f7);
          border: 1px solid transparent;
          color: var(--color-ink, #1d1d1f);
          text-decoration: none;
          font-size: 14px;
          line-height: 1.43;
          font-weight: 500;
          letter-spacing: -0.04px;
          transition: background-color .1s ease, border-color .1s ease, color .1s ease;
        }

        .nf-links a:hover{
          border-color: var(--color-silver-mist, #e8e8ed);
          color: var(--color-cobalt-link, #0066cc);
        }

        .nf-orbit{
          align-self: stretch;
          display: flex;
          align-items: stretch;
        }

        .nf-orbit-card{
          width: 100%;
          min-height: 470px;
          border-radius: 28px;
          border: 1px solid var(--color-silver-mist, #e8e8ed);
          background:
            linear-gradient(180deg, rgba(255,255,255,.78), rgba(255,255,255,.94)),
            radial-gradient(circle at 50% 12%, rgba(0,113,227,.12), transparent 40%);
          padding: 22px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }

        .nf-orbit-top{
          display: flex;
          gap: 7px;
          margin-bottom: auto;
        }

        .nf-orbit-top span{
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: var(--color-silver-mist, #e8e8ed);
        }

        .nf-orbit-number{
          font-family: var(--font-sf-pro-display, Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif);
          font-size: 82px;
          line-height: .92;
          letter-spacing: -0.07em;
          font-weight: 700;
          color: var(--color-ink, #1d1d1f);
        }

        .nf-orbit-line{
          height: 1px;
          background: var(--color-silver-mist, #e8e8ed);
          margin: 18px 0 12px;
        }

        .nf-orbit-row{
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 10px 0;
          color: var(--color-graphite, #707070);
          font-size: 14px;
          letter-spacing: -0.04px;
        }

        .nf-orbit-row strong{
          color: var(--color-ink, #1d1d1f);
          font-weight: 600;
        }

        @media (max-width: 980px){
          .nf-shell{
            grid-template-columns: 1fr;
          }

          .nf-orbit{
            display: none;
          }
        }

        @media (max-width: 520px){
          .nf-root{
            padding: 92px 14px 38px;
          }

          .nf-card{
            border-radius: 24px;
            min-height: auto;
            padding: 26px 20px;
          }

          .nf-path{
            align-items: flex-start;
            flex-direction: column;
            gap: 4px;
          }

          .nf-path-value{
            width: 100%;
            text-align: left;
          }

          .nf-links{
            grid-template-columns: 1fr;
          }
        }

        @media (prefers-reduced-motion: reduce){
          .nf-btn,
          .nf-links a{
            transition: none;
          }
        }
      `}</style>
    </>
  );
}

export default NotFoundPage;
