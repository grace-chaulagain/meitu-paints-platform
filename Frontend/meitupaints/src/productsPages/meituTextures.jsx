import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import NavBar from "../components/NavBar";
import graniteTexturesRaw from "../ProductsList/graniteTextures.json";
import {
  ArrowIcon,
  PaletteIcon,
  SearchIcon,
  ShieldIcon,
  TextureIcon,
} from "../components/ui/ApplePageIcons.jsx";

function normalize(value = "") {
  return String(value).trim().toLowerCase();
}

function assetPath(src = "") {
  const clean = String(src).trim();
  if (!clean) return "";
  if (/^(https?:)?\/\//.test(clean) || clean.startsWith("/")) return clean;
  return `/${clean}`;
}

export default function MeituTextures() {
  const pageRef = useRef(null);
  const modalRef = useRef(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(null);

  const textures = useMemo(() => {
    const list = Array.isArray(graniteTexturesRaw) ? graniteTexturesRaw : [];
    return list
      .map((texture, index) => {
        const code = String(texture.textureCode ?? texture.code ?? "").trim();
        const filename = String(texture.filename ?? `${code}.webp`).trim();
        const src = assetPath(texture.src ?? `Granite Textures/${filename}`);
        const id = String(texture.id ?? `texture-${code || index + 1}`);

        return {
          ...texture,
          id,
          code,
          filename,
          src,
          q: normalize(`${id} ${code} ${filename}`),
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return textures;
    return textures.filter((texture) => texture.q.includes(q));
  }, [query, textures]);

  const featured = useMemo(() => textures.slice(0, 6), [textures]);

  useEffect(() => {
    const root = pageRef.current;
    if (!root) return;

    const items = root.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }),
      { threshold: 0.12 },
    );

    items.forEach((item) => io.observe(item));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => modalRef.current?.focus?.(), 0);

    return () => {
      window.clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);

  return (
    <>
      <NavBar />
      <main ref={pageRef} className="apple-texture-page">
        <section className="texture-hero" data-reveal>
          <div className="texture-hero-copy">
            <p>Meitu texture studio</p>
            <h1>Granite surfaces, selected by code.</h1>
            <span>
              Search texture references, inspect the finish closely, and send a
              precise inquiry with the selected code.
            </span>
            <div className="texture-hero-actions">
              <a href="#texture-library" className="texture-pill primary">
                Browse library <ArrowIcon />
              </a>
              <Link to="/granite" className="texture-link">
                Granite products <ArrowIcon />
              </Link>
            </div>
          </div>

          <div className="texture-stage" aria-hidden="true">
            <div className="texture-stage-backdrop" />
            {featured[0] ? (
              <div className="texture-focus-plate">
                <img src={featured[0].src} alt="" />
              </div>
            ) : null}
            {featured.slice(1, 3).map((texture, index) => (
              <span key={texture.id} className={`texture-orbit orbit-${index + 1}`}>
                <img src={texture.src} alt="" />
              </span>
            ))}
            <div className="texture-stage-label">
              <TextureIcon />
              <strong>{textures.length}</strong>
              <small>granite texture references</small>
            </div>
          </div>
        </section>

        <section className="texture-console" data-reveal>
          <div className="texture-search-panel">
            <div className="texture-search-heading">
              <div>
                <p>Find texture</p>
                <h2>Search by texture code.</h2>
              </div>
              <span>
                {filtered.length} / {textures.length}
              </span>
            </div>

            <label className="texture-search" htmlFor="texture-search">
              <SearchIcon />
              <input
                id="texture-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try 201, 6004, 7019..."
                aria-label="Search texture code"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")}>
                  Clear
                </button>
              ) : null}
            </label>
          </div>

          <div className="texture-utility-grid">
            {[
              ["Code-first", "Fast dealer matching.", <TextureIcon />],
              ["Preview", "Large finish inspection.", <PaletteIcon />],
              ["Inquiry", "Send the selected code.", <ShieldIcon />],
            ].map(([title, copy, icon]) => (
              <article key={title} className="texture-utility-card">
                <span>{icon}</span>
                <strong>{title}</strong>
                <small>{copy}</small>
              </article>
            ))}
          </div>
        </section>

        <section
          id="texture-library"
          className="texture-library"
          data-reveal
          aria-label="Granite texture library"
        >
          {filtered.length ? (
            <div className="texture-grid">
              {filtered.map((texture, index) => (
                <button
                  key={texture.id}
                  type="button"
                  className="texture-card"
                  style={{ "--delay": `${Math.min(index * 18, 420)}ms` }}
                  onClick={() => setActive(texture)}
                  aria-label={`Preview texture ${texture.code}`}
                >
                  <img
                    src={texture.src}
                    alt={`Texture ${texture.code}`}
                    loading="lazy"
                  />
                  <span>
                    <strong>{texture.code}</strong>
                    <small>
                      Preview <ArrowIcon />
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="texture-empty">
              <TextureIcon />
              <strong>No textures found.</strong>
              <span>Try another texture code.</span>
            </div>
          )}
        </section>
      </main>

      {active
        ? createPortal(
            <div className="texture-modal" role="dialog" aria-modal="true">
              <button
                className="texture-modal-backdrop"
                type="button"
                aria-label="Close texture preview"
                onClick={() => setActive(null)}
              />
              <article
                ref={modalRef}
                className="texture-modal-card"
                tabIndex={-1}
              >
                <button
                  type="button"
                  className="texture-modal-close"
                  onClick={() => setActive(null)}
                  aria-label="Close texture preview"
                >
                  ×
                </button>
                <div className="texture-modal-image">
                  <img src={active.src} alt={`Texture ${active.code}`} />
                </div>
                <div className="texture-modal-copy">
                  <p>Granite texture</p>
                  <h2>{active.code}</h2>
                  <span>
                    Use this texture code when discussing granite texture
                    selections, dealer orders, or finish inquiries.
                  </span>
                  <Link
                    to={`/inquiry?subject=${encodeURIComponent(`Texture ${active.code}`)}`}
                    onClick={() => setActive(null)}
                    className="texture-pill primary"
                  >
                    Inquire about this texture <ArrowIcon />
                  </Link>
                </div>
              </article>
            </div>,
            document.body,
          )
        : null}

      <style>{`
        .apple-texture-page{
          min-height:100vh;
          background:#f5f5f7;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-text, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          overflow:hidden;
        }

        .apple-texture-page svg,
        .texture-modal svg{
          width:1em;
          height:1em;
          fill:none;
          stroke:currentColor;
          stroke-width:2;
          stroke-linecap:round;
          stroke-linejoin:round;
        }

        .apple-texture-page a,
        .texture-modal a{
          text-decoration:none;
        }

        .texture-hero{
          width:100%;
          min-height:calc(100vh - 44px);
          padding:clamp(54px, 8vw, 96px) max(20px, calc((100% - 1180px) / 2)) 54px;
          display:grid;
          grid-template-columns:minmax(0,.9fr) minmax(360px,1fr);
          gap:clamp(28px, 6vw, 78px);
          align-items:center;
          background:var(--meitu-home-hero-gradient, linear-gradient(135deg, #f5f5f7 0%, #fff 48%, #e8e8ed 100%));
          position:relative;
        }

        .texture-hero::before{
          content:"";
          position:absolute;
          inset:0;
          background:
            radial-gradient(circle at 16% 12%, rgba(255,255,255,.95), transparent 24%),
            radial-gradient(circle at 72% 18%, rgba(0,113,227,.13), transparent 28%),
            radial-gradient(circle at 88% 74%, rgba(245,0,180,.09), transparent 24%);
          pointer-events:none;
        }

        .texture-hero-copy,
        .texture-stage{
          position:relative;
          z-index:1;
        }

        .texture-hero-copy p,
        .texture-search-heading p,
        .texture-modal-copy p{
          margin:0 0 10px;
          color:#707070;
          font-size:12px;
          line-height:1.33;
          font-weight:600;
          letter-spacing:-.003em;
          text-transform:uppercase;
        }

        .texture-hero-copy h1{
          max-width:720px;
          margin:0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          font-size:clamp(48px, 8vw, 92px);
          line-height:1.04;
          letter-spacing:-2px;
          font-weight:700;
        }

        .texture-hero-copy > span{
          display:block;
          max-width:560px;
          margin-top:20px;
          color:#474747;
          font-size:clamp(18px, 2vw, 23px);
          line-height:1.38;
          letter-spacing:-.2px;
          font-weight:300;
        }

        .texture-hero-actions{
          display:flex;
          align-items:center;
          flex-wrap:wrap;
          gap:18px;
          margin-top:30px;
        }

        .texture-pill,
        .texture-link{
          display:inline-flex;
          align-items:center;
          gap:8px;
          font-size:17px;
          line-height:1.24;
          font-weight:400;
          letter-spacing:-.1px;
        }

        .texture-pill.primary{
          min-height:42px;
          padding:0 18px;
          border-radius:999px;
          background:#0071e3;
          color:#fff;
          transition:filter .18s ease, transform .18s ease;
        }

        .texture-pill.primary:hover{
          filter:brightness(1.04);
          transform:translateY(-1px);
        }

        .texture-link{
          color:#0066cc;
        }

        .texture-link svg,
        .texture-card small svg{
          transition:transform .18s ease;
        }

        .texture-link:hover svg,
        .texture-card:hover small svg{
          transform:translateX(3px);
        }

        .texture-stage{
          min-height:560px;
          border-radius:36px;
          overflow:hidden;
          background:rgba(255,255,255,.68);
          border:1px solid rgba(255,255,255,.74);
          backdrop-filter:blur(24px);
          -webkit-backdrop-filter:blur(24px);
        }

        .texture-stage-backdrop{
          position:absolute;
          inset:0;
          background:
            radial-gradient(circle at 52% 22%, rgba(255,255,255,.96), transparent 21%),
            radial-gradient(circle at 78% 68%, rgba(0,113,227,.16), transparent 27%),
            linear-gradient(150deg, #1d1d1f 0%, #dfe7ef 46%, #f5f5f7 100%);
          opacity:.92;
          animation:textureGlow 6.5s ease-in-out infinite alternate;
        }

        .texture-focus-plate{
          position:absolute;
          left:50%;
          top:50%;
          width:min(430px, 78%);
          aspect-ratio:1;
          border-radius:34px;
          overflow:hidden;
          border:1px solid rgba(255,255,255,.82);
          background:rgba(255,255,255,.9);
          transform:translate(-50%, -50%);
          animation:texturePlateFloat 7s ease-in-out infinite alternate;
        }

        .texture-focus-plate::after{
          content:"";
          position:absolute;
          inset:0;
          background:
            linear-gradient(180deg, rgba(255,255,255,.16), transparent 35%),
            radial-gradient(circle at 50% 0%, rgba(255,255,255,.32), transparent 30%);
          pointer-events:none;
        }

        .texture-orbit{
          position:absolute;
          width:118px;
          aspect-ratio:1;
          border-radius:26px;
          overflow:hidden;
          background:#fff;
          border:1px solid rgba(255,255,255,.78);
          animation:textureOrbitFloat 6.4s ease-in-out infinite alternate;
        }

        .texture-orbit.orbit-1{
          right:9%;
          top:13%;
        }

        .texture-orbit.orbit-2{
          left:9%;
          bottom:18%;
          animation-delay:-1.4s;
        }

        .texture-focus-plate img,
        .texture-orbit img{
          width:100%;
          height:100%;
          display:block;
          object-fit:cover;
        }

        .texture-stage-label{
          position:absolute;
          left:24px;
          right:24px;
          bottom:24px;
          min-height:76px;
          border-radius:24px;
          padding:16px 18px;
          display:grid;
          grid-template-columns:36px auto 1fr;
          align-items:center;
          gap:12px;
          background:rgba(255,255,255,.78);
          backdrop-filter:blur(22px);
          -webkit-backdrop-filter:blur(22px);
        }

        .texture-stage-label svg{
          width:24px;
          height:24px;
        }

        .texture-stage-label strong{
          color:#1d1d1f;
          font-size:30px;
          line-height:1;
          letter-spacing:-.6px;
        }

        .texture-stage-label small{
          color:#707070;
          font-size:13px;
          line-height:1.2;
        }

        .texture-console,
        .texture-library{
          width:min(1180px, calc(100vw - 40px));
          margin:0 auto;
        }

        .texture-console{
          display:grid;
          grid-template-columns:minmax(0,1fr) 390px;
          gap:18px;
          padding:24px 0 34px;
        }

        .texture-search-panel,
        .texture-utility-card,
        .texture-empty{
          background:#fff;
          border:1px solid #e8e8ed;
          border-radius:28px;
          box-shadow:none;
        }

        .texture-search-panel{
          padding:24px;
        }

        .texture-search-heading{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
        }

        .texture-search-heading h2{
          margin:0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          font-size:32px;
          line-height:1.1;
          letter-spacing:-.5px;
          font-weight:700;
        }

        .texture-search-heading > span{
          min-height:34px;
          padding:0 13px;
          border-radius:999px;
          display:inline-flex;
          align-items:center;
          background:#f5f5f7;
          color:#707070;
          font-size:13px;
          font-weight:600;
        }

        .texture-search{
          min-height:54px;
          margin-top:18px;
          display:grid;
          grid-template-columns:22px minmax(0,1fr) auto;
          align-items:center;
          gap:10px;
          border-radius:999px;
          background:#f5f5f7;
          padding:0 9px 0 17px;
          color:#707070;
        }

        .texture-search input{
          min-width:0;
          border:0;
          outline:0;
          background:transparent;
          color:#1d1d1f;
          font:inherit;
          font-size:16px;
        }

        .texture-search button{
          min-height:38px;
          border:0;
          border-radius:999px;
          background:#fff;
          padding:0 14px;
          color:#1d1d1f;
          font:inherit;
          font-size:14px;
          font-weight:500;
          cursor:pointer;
        }

        .texture-utility-grid{
          display:grid;
          grid-template-columns:repeat(3, minmax(0,1fr));
          gap:10px;
        }

        .texture-utility-card{
          min-height:154px;
          padding:18px;
          display:grid;
          align-content:start;
          gap:8px;
        }

        .texture-utility-card > span{
          width:38px;
          height:38px;
          border-radius:999px;
          display:grid;
          place-items:center;
          background:#f5f5f7;
          color:#1d1d1f;
        }

        .texture-utility-card strong{
          color:#1d1d1f;
          font-size:14px;
          line-height:1.2;
          font-weight:600;
        }

        .texture-utility-card small{
          color:#707070;
          font-size:12px;
          line-height:1.35;
        }

        .texture-grid{
          display:grid;
          grid-template-columns:repeat(auto-fill, minmax(150px,1fr));
          gap:14px;
          padding:0 0 84px;
        }

        .texture-card{
          border:0;
          border-radius:24px;
          background:#fff;
          padding:10px;
          display:grid;
          gap:11px;
          text-align:left;
          cursor:pointer;
          opacity:0;
          transform:translateY(12px);
          animation:textureCardIn .42s ease forwards;
          animation-delay:var(--delay);
          transition:background-color .18s ease, transform .18s ease;
        }

        .texture-card:hover{
          background:#fafafa;
          transform:translateY(-2px);
        }

        .texture-card img{
          width:100%;
          aspect-ratio:1;
          display:block;
          object-fit:cover;
          border-radius:18px;
          background:#f5f5f7;
        }

        .texture-card > span{
          display:flex;
          align-items:end;
          justify-content:space-between;
          gap:8px;
          padding:0 4px 4px;
        }

        .texture-card strong{
          color:#1d1d1f;
          font-size:16px;
          line-height:1.2;
          font-weight:600;
        }

        .texture-card small{
          display:inline-flex;
          align-items:center;
          gap:4px;
          color:#0066cc;
          font-size:12px;
          line-height:1.2;
        }

        .texture-empty{
          margin-bottom:84px;
          padding:64px 20px;
          display:grid;
          justify-items:center;
          gap:8px;
          text-align:center;
        }

        .texture-empty svg{
          width:28px;
          height:28px;
        }

        .texture-empty strong{
          color:#1d1d1f;
          font-size:18px;
        }

        .texture-empty span{
          color:#707070;
          font-size:14px;
        }

        .texture-modal{
          position:fixed;
          inset:0;
          z-index:10020;
          display:grid;
          place-items:center;
          padding:24px;
        }

        .texture-modal-backdrop{
          position:fixed;
          inset:0;
          border:0;
          background:rgba(245,245,247,.72);
          backdrop-filter:blur(28px);
          -webkit-backdrop-filter:blur(28px);
        }

        .texture-modal-card{
          position:relative;
          width:min(980px,100%);
          display:grid;
          grid-template-columns:minmax(0,1.06fr) minmax(300px,.94fr);
          border-radius:28px;
          background:#fff;
          border:1px solid #e8e8ed;
          overflow:hidden;
          outline:0;
          animation:textureModalIn .28s ease both;
        }

        .texture-modal-image{
          min-height:500px;
          background:#f5f5f7;
        }

        .texture-modal-image img{
          width:100%;
          height:100%;
          display:block;
          object-fit:cover;
        }

        .texture-modal-copy{
          align-self:center;
          padding:clamp(30px,5vw,58px);
        }

        .texture-modal-copy h2{
          margin:0;
          color:#1d1d1f;
          font-family:var(--font-sf-pro-display, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
          font-size:clamp(52px,7vw,86px);
          line-height:1.02;
          letter-spacing:-2px;
          font-weight:700;
        }

        .texture-modal-copy > span{
          display:block;
          margin-top:18px;
          color:#707070;
          font-size:18px;
          line-height:1.45;
        }

        .texture-modal-copy .texture-pill{
          margin-top:26px;
        }

        .texture-modal-close{
          position:absolute;
          top:16px;
          right:16px;
          z-index:2;
          width:38px;
          height:38px;
          border:0;
          border-radius:999px;
          background:rgba(232,232,237,.82);
          color:#1d1d1f;
          font-size:24px;
          line-height:1;
          cursor:pointer;
        }

        [data-reveal]{
          opacity:0;
          transform:translateY(18px);
          transition:opacity .58s cubic-bezier(.22,.61,.36,1), transform .58s cubic-bezier(.22,.61,.36,1);
        }

        [data-reveal].is-in{
          opacity:1;
          transform:translateY(0);
        }

        @keyframes textureGlow{
          from{ filter:saturate(1.02) brightness(1); }
          to{ filter:saturate(1.16) brightness(1.04); }
        }

        @keyframes textureFloat{
          from{ transform:translateY(0); }
          to{ transform:translateY(-12px); }
        }

        @keyframes texturePlateFloat{
          from{ transform:translate(-50%, -50%); }
          to{ transform:translate(-50%, calc(-50% - 10px)); }
        }

        @keyframes textureOrbitFloat{
          from{ transform:translateY(0); }
          to{ transform:translateY(-9px); }
        }

        @keyframes textureCardIn{
          to{ opacity:1; transform:translateY(0); }
        }

        @keyframes textureModalIn{
          from{ opacity:0; transform:translateY(14px) scale(.985); }
          to{ opacity:1; transform:translateY(0) scale(1); }
        }

        @media (max-width:980px){
          .texture-hero,
          .texture-console,
          .texture-modal-card{
            grid-template-columns:1fr;
          }

          .texture-hero{
            min-height:auto;
          }

          .texture-stage{
            min-height:430px;
          }

          .texture-utility-grid{
            grid-template-columns:1fr;
          }

          .texture-modal-image{
            min-height:330px;
          }
        }

        @media (max-width:640px){
          .texture-hero{
            padding:38px 14px 34px;
          }

          .texture-hero-copy h1{
            font-size:44px;
            letter-spacing:-.9px;
          }

          .texture-hero-copy > span{
            font-size:17px;
            font-weight:400;
          }

          .texture-stage{
            min-height:360px;
            border-radius:28px;
          }

          .texture-console,
          .texture-library{
            width:calc(100vw - 28px);
          }

          .texture-console{
            padding-top:16px;
          }

          .texture-grid{
            grid-template-columns:repeat(2, minmax(0,1fr));
            gap:12px;
          }

          .texture-modal{
            padding:12px;
          }

          .texture-modal-card{
            border-radius:24px;
          }
        }

        @media (prefers-reduced-motion:reduce){
          .texture-stage-backdrop,
          .texture-focus-plate,
          .texture-orbit,
          .texture-card,
          .texture-modal-card,
          [data-reveal]{
            animation:none !important;
            transition:none !important;
          }

          [data-reveal],
          .texture-card{
            opacity:1 !important;
            transform:none !important;
          }
        }
      `}</style>
    </>
  );
}
