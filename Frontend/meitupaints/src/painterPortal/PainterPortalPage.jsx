import { useEffect, useRef, useState } from "react";

import { COPY, formatNumber, localizeDigits } from "./painterPortalCopy.js";

// The painter portal: a painter scans a QR, types the ID from their card, and
// sees their points and the gifts they are working towards. No login, no
// account, nothing to remember.
//
// It is built for someone standing in a shop on a phone who may not use
// software often - one field, one button, one very large number - while
// dressing exactly like the rest of the public site (DESIGN.md): fog canvas,
// white cards with a hairline border and no drop shadow, 28px card radius,
// pill buttons, Apple blue used sparingly for the one action and the one
// progress bar.

// Same rule as api/client.js: in dev the SPA runs on its own port and the API
// is on 5002; in production they share one origin.
function apiBase() {
  const configured = (import.meta.env.VITE_API_BASE_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") {
    const { protocol = "http:", hostname = "localhost", port = "" } = window.location || {};
    if (import.meta.env.DEV || port === "5173") return `${protocol}//${hostname}:5002`;
  }
  return "";
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// The points total counts up once, on arrival. It is the whole reason the
// painter came, it is seen rarely, and the movement is what makes the number
// feel earned rather than printed - exactly the case where a little delight
// belongs. Anyone who asks for less motion is simply given the number.
function useCountUp(target, duration = 900) {
  const reduced = prefersReducedMotion();
  // Progress runs 0 -> 1 and the number is derived from it, so the animation
  // owns one piece of state and nothing is copied between renders.
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduced || !target) return undefined;
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = Math.min(1, (now - start) / duration);
      setProgress(elapsed);
      if (elapsed < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);

  if (reduced || !target) return target;
  // easeOutCubic: quick off the mark, settling at the end - the same shape as
  // the --ease-out curve everything else on this page uses.
  return Math.round(target * (1 - (1 - progress) ** 3));
}

function LanguageToggle({ lang, onChange, label }) {
  return (
    <button type="button" className="pp-lang" onClick={() => onChange(lang === "ne" ? "en" : "ne")}>
      {label}
    </button>
  );
}

function GiftRow({ gift, lang, t, index }) {
  const name = (lang === "ne" && gift.nameNepali) || gift.name;
  return (
    <li className={`pp-gift ${gift.earned ? "is-earned" : ""}`} style={{ "--i": index }}>
      <span className="pp-gift-media" aria-hidden="true">
        {gift.imageUrl ? <img src={gift.imageUrl} alt="" loading="lazy" /> : <GiftGlyph />}
      </span>
      <span className="pp-gift-text">
        <span className="pp-gift-name">{name}</span>
        <span className="pp-gift-need">
          {formatNumber(gift.pointsRequired, lang)} {t.pointsWord}
        </span>
      </span>
      <span className={`pp-gift-state ${gift.earned ? "is-earned" : ""}`}>
        {gift.earned ? (
          <>
            <CheckGlyph />
            {t.earned}
          </>
        ) : (
          t.pointsToGo(formatNumber(gift.remaining, lang))
        )}
      </span>
    </li>
  );
}

// Line icons, monochrome, in the site's icon language - no emoji.
function GiftGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v8h14v-8M12 8v12" />
      <path d="M12 8c-1.5-3-5-3.5-5-1s3.5 1 5 1Zm0 0c1.5-3 5-3.5 5-1s-3.5 1-5 1Z" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export default function PainterPortalPage() {
  const [lang, setLang] = useState("ne");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const t = COPY[lang];

  useEffect(() => {
    document.title = lang === "ne" ? "मेइतु पेन्टर पोइन्ट" : "Meitu Painter Points";
  }, [lang]);

  async function submit(event) {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 4) {
      setError(t.tooShort);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/api/painter-portal/lookup?q=${encodeURIComponent(text)}`);
      const body = await response.json().catch(() => ({}));
      if (response.ok) {
        setResult(body);
      } else if (response.status === 404) {
        setError(t.notFound);
      } else if (response.status === 429) {
        setError(t.rateLimited);
      } else if (response.status === 400) {
        setError(t.tooShort);
      } else {
        setError(t.failed);
      }
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setResult(null);
    setError("");
    setQuery("");
    // Straight back to typing, so a second painter can check in one tap.
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  const points = result?.points?.earned ?? 0;
  const gifts = result?.gifts || [];
  const next = result?.nextGift || null;
  // How far along the next gift they are. With no next gift the bar is full,
  // which is exactly what "you have earned every gift" should look like.
  const progress = next ? Math.min(100, Math.round((points / next.pointsRequired) * 100)) : 100;
  const shownPoints = useCountUp(points);

  return (
    <div className={`pp-root pp-${lang}`}>
      <PortalStyles />
      <header className="pp-header">
        <a className="pp-logo" href="/" aria-label="Meitu Paints">
          <img src="/meitulogo.svg" alt="" width="34" height="34" />
          <span className="pp-brand">{t.brand}</span>
        </a>
        <LanguageToggle lang={lang} onChange={setLang} label={t.langButton} />
      </header>

      <main className="pp-main">
        {!result ? (
          // `key` restarts the entrance when a painter comes back to search
          // again, so the second visit feels like the first.
          <form key="search" className="pp-card pp-search pp-enter" onSubmit={submit}>
            <h1 className="pp-title">{t.searchTitle}</h1>
            <p className="pp-lede">{t.searchHint}</p>
            <input
              id="pp-id"
              ref={inputRef}
              className="pp-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.placeholder}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              enterKeyHint="search"
              inputMode="text"
              aria-label={t.searchHint}
            />
            {error ? (
              <p className="pp-error" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="pp-submit" disabled={busy}>
              {busy ? t.searching : t.submit}
            </button>
          </form>
        ) : (
          <div key="result" className="pp-result">
            <section className="pp-card pp-points pp-enter" style={{ "--i": 0 }}>
              <p className="pp-greeting">{t.greeting(result.painter?.name || "")}</p>
              <p className="pp-period">
                {result.period?.mode === "FISCAL_YEAR"
                  ? t.fiscalYear(localizeDigits(result.period.label, lang))
                  : t.allTime}
              </p>
              <p className="pp-total">
                <span className="pp-total-number">{formatNumber(shownPoints, lang)}</span>
                <span className="pp-total-word">{t.pointsWord}</span>
              </p>

              {next ? (
                <div className="pp-next">
                  <div className="pp-bar" role="img" aria-label={`${progress}%`}>
                    <span className="pp-bar-fill" style={{ "--p": progress / 100 }} />
                  </div>
                  <p className="pp-next-label">
                    {t.nextGift}: <strong>{(lang === "ne" && next.nameNepali) || next.name}</strong>
                  </p>
                  <p className="pp-next-need">{t.pointsToGo(formatNumber(next.remaining, lang))}</p>
                </div>
              ) : gifts.length ? (
                <p className="pp-all-earned">{t.allEarned}</p>
              ) : null}

              {points === 0 ? <p className="pp-zero">{t.zeroPoints}</p> : null}
              {result.painter && result.painter.isActive === false ? <p className="pp-zero">{t.inactive}</p> : null}
            </section>

            <section className="pp-card pp-enter" style={{ "--i": 1 }}>
              <h2 className="pp-subtitle">{t.allGifts}</h2>
              {gifts.length ? (
                <ul className="pp-gifts">
                  {gifts.map((gift, index) => (
                    <GiftRow key={gift.id} gift={gift} lang={lang} t={t} index={index} />
                  ))}
                </ul>
              ) : (
                <p className="pp-empty">{t.noGifts}</p>
              )}
            </section>

            <button type="button" className="pp-again pp-enter" style={{ "--i": 2 }} onClick={startOver}>
              {t.searchAgain}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function PortalStyles() {
  return (
    <style>{`
      .pp-root{
        min-height:100dvh;
        background:var(--color-fog, #f5f5f7);
        color:var(--color-ink, #1d1d1f);
        font-family:var(--font-sf-pro-text, Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif);
        padding:0 0 56px;
        -webkit-font-smoothing:antialiased;
      }

      /* --- header: the site's frosted chrome, stripped to a mark and one control --- */
      .pp-header{
        position:sticky; top:0; z-index:5;
        display:flex; align-items:center; justify-content:space-between; gap:12px;
        padding:14px 20px;
        background:rgba(255,255,255,.82);
        backdrop-filter:saturate(180%) blur(20px);
        -webkit-backdrop-filter:saturate(180%) blur(20px);
        border-bottom:1px solid rgba(232,232,237,.9);
      }
      .pp-logo{ display:inline-flex; align-items:center; gap:10px; text-decoration:none; color:inherit; }
      .pp-brand{
        font-family:var(--font-sf-pro-display, inherit);
        font-size:17px; font-weight:600; letter-spacing:-.02em;
      }
      .pp-lang{
        min-height:38px; padding:0 16px; border-radius:999px;
        border:1px solid rgba(232,232,237,.9); background:#fff;
        color:var(--color-ink,#1d1d1f);
        font:inherit; font-size:15px; font-weight:500; cursor:pointer;
        transition:transform .14s var(--ease-out, cubic-bezier(.23,1,.32,1)), background .14s ease;
      }
      .pp-lang:hover{ background:var(--color-fog,#f5f5f7); }
      .pp-lang:active{ transform:scale(.97); }

      .pp-main{ max-width:620px; margin:0 auto; padding:28px 20px 0; display:grid; gap:16px; }
      /* With only the one card on screen, centring it in the space below the
         header puts the field under the thumb instead of leaving a long empty
         page beneath it. */
      .pp-main:has(> .pp-search){
        min-height:calc(100dvh - 68px - 56px);
        align-content:center;
        padding-bottom:28px;
      }
      .pp-result{ display:grid; gap:16px; }

      /* --- surfaces: white, hairline border, no drop shadow (DESIGN.md) --- */
      .pp-card{
        background:var(--color-snow, #fff);
        border:1px solid rgba(232,232,237,.9);
        border-radius:28px;
        padding:28px 24px;
      }

      /* --- type: display face, confident and tight, calm supporting copy --- */
      .pp-title{
        margin:0 0 8px;
        font-family:var(--font-sf-pro-display, inherit);
        font-size:34px; font-weight:700; line-height:1.05; letter-spacing:-.035em;
        text-wrap:balance;
      }
      .pp-subtitle{
        margin:0 0 16px;
        font-family:var(--font-sf-pro-display, inherit);
        font-size:22px; font-weight:600; letter-spacing:-.02em;
      }
      .pp-lede{
        margin:0 0 18px;
        font-size:17px; font-weight:400; line-height:1.45; color:var(--color-graphite,#707070);
      }

      /* 17px+ so iOS never zooms on focus; the ring is soft and outside. */
      .pp-input{
        width:100%; height:56px; padding:0 18px; border-radius:16px;
        border:1px solid rgba(29,29,31,.14); background:#fff;
        font:inherit; font-size:19px; font-weight:500; letter-spacing:.01em;
        color:var(--color-ink,#1d1d1f);
        transition:border-color .16s ease, box-shadow .16s ease;
      }
      .pp-input::placeholder{ color:#b6b6bd; font-weight:400; }
      .pp-input:focus{
        outline:none; border-color:var(--color-azure,#0071e3);
        box-shadow:0 0 0 4px rgba(0,113,227,.14);
      }

      .pp-submit, .pp-again{
        width:100%; min-height:54px; border:0; border-radius:999px;
        background:var(--color-azure,#0071e3); color:#fff;
        font:inherit; font-size:17px; font-weight:500; cursor:pointer;
        transition:transform .16s var(--ease-out, cubic-bezier(.23,1,.32,1)), background .16s ease, box-shadow .16s ease;
      }
      .pp-submit{ margin-top:18px; }
      .pp-submit:hover{ background:#0077ed; }
      /* Every pressable thing answers the finger immediately. */
      .pp-submit:active, .pp-again:active{ transform:scale(.97); }
      .pp-submit:disabled{ background:rgba(0,113,227,.4); cursor:default; transform:none; }
      .pp-again{
        background:#fff; color:var(--color-cobalt-link,#0066cc);
        border:1px solid rgba(232,232,237,.9);
      }
      .pp-again:hover{ background:#fff; box-shadow:0 0 0 1px rgba(0,113,227,.25); }

      .pp-error{
        margin:16px 0 0; padding:13px 16px; border-radius:16px;
        background:rgba(182,68,0,.08); color:var(--color-caution,#b64400);
        font-size:16px; font-weight:500; line-height:1.4;
      }

      /* --- the one number the painter came for --- */
      .pp-points{ text-align:center; }
      .pp-greeting{
        margin:0;
        font-family:var(--font-sf-pro-display, inherit);
        font-size:24px; font-weight:600; letter-spacing:-.02em; line-height:1.2;
        text-wrap:balance;
      }
      .pp-period{ margin:8px 0 0; font-size:15px; font-weight:400; color:var(--color-graphite,#707070); }
      .pp-total{ margin:18px 0 0; display:flex; align-items:baseline; justify-content:center; gap:10px; flex-wrap:wrap; }
      .pp-total-number{
        font-family:var(--font-sf-pro-display, inherit);
        font-size:76px; font-weight:700; letter-spacing:-.05em; line-height:1;
        font-variant-numeric:tabular-nums;
      }
      .pp-total-word{ font-size:19px; font-weight:400; color:var(--color-graphite,#707070); }

      .pp-next{ margin-top:24px; }
      .pp-bar{ height:10px; border-radius:999px; background:var(--color-silver-mist,#e8e8ed); overflow:hidden; }
      /* scaleX, not width: it runs on the compositor, so the fill never
         competes with the count-up for the main thread. */
      .pp-bar-fill{
        display:block; height:100%; border-radius:999px; transform-origin:left center;
        background:var(--color-azure,#0071e3);
        transform:scaleX(var(--p, 0));
        animation:ppBar .72s var(--ease-out, cubic-bezier(.23,1,.32,1)) .18s backwards;
      }
      @keyframes ppBar{ from{ transform:scaleX(0); } }
      .pp-next-label{ margin:14px 0 0; font-size:17px; font-weight:400; color:var(--color-slate,#474747); }
      .pp-next-label strong{ font-weight:600; color:var(--color-ink,#1d1d1f); }
      .pp-next-need{ margin:4px 0 0; font-size:16px; font-weight:500; color:var(--color-azure,#0071e3); }
      .pp-all-earned{ margin:20px 0 0; font-size:18px; font-weight:500; color:#15803d; }
      .pp-zero{ margin:18px 0 0; font-size:16px; font-weight:400; line-height:1.5; color:var(--color-graphite,#707070); }

      /* --- the ladder --- */
      .pp-gifts{ list-style:none; margin:0; padding:0; display:grid; gap:10px; }
      .pp-gift{
        display:flex; align-items:center; gap:14px;
        padding:14px; border-radius:20px;
        background:var(--color-fog,#f5f5f7);
        animation:ppRow .42s var(--ease-out, cubic-bezier(.23,1,.32,1)) calc(.12s + var(--i, 0) * .05s) backwards;
      }
      @keyframes ppRow{ from{ opacity:0; transform:translateY(10px); } }
      .pp-gift.is-earned{ background:rgba(21,128,61,.07); }
      .pp-gift-media{
        width:52px; height:52px; flex:none; border-radius:16px; overflow:hidden;
        background:#fff; display:grid; place-items:center;
        color:var(--color-graphite,#707070);
        border:1px solid rgba(232,232,237,.9);
      }
      .pp-gift-media img{ width:100%; height:100%; object-fit:cover; }
      .pp-gift-text{ display:grid; gap:2px; min-width:0; flex:1 1 auto; }
      .pp-gift-name{ font-size:17px; font-weight:500; line-height:1.3; letter-spacing:-.01em; }
      .pp-gift-need{ font-size:14px; font-weight:400; color:var(--color-graphite,#707070); }
      .pp-gift-state{
        flex:none; display:inline-flex; align-items:center; gap:5px; max-width:42%;
        text-align:right; font-size:14px; font-weight:500; color:var(--color-azure,#0071e3);
      }
      .pp-gift-state.is-earned{ color:#15803d; }
      .pp-empty{ margin:0; font-size:16px; color:var(--color-graphite,#707070); }

      /* --- entrances: the site's own fade-up, staggered per card --- */
      .pp-enter{
        animation:ppEnter .5s var(--ease-out, cubic-bezier(.23,1,.32,1)) calc(var(--i, 0) * .07s) backwards;
      }
      @keyframes ppEnter{
        from{ opacity:0; transform:translateY(16px) scale(.985); filter:blur(6px); }
        to{ opacity:1; transform:none; filter:blur(0); }
      }

      /* Devanagari sits taller than Latin and its conjuncts need their width:
         the negative tracking that makes a Latin headline feel confident just
         crushes this script, so it is removed and the leading opened up. */
      .pp-ne .pp-title, .pp-ne .pp-subtitle, .pp-ne .pp-greeting, .pp-ne .pp-total-number{ letter-spacing:0; }
      .pp-ne .pp-title{ font-size:31px; line-height:1.3; }
      .pp-ne .pp-subtitle{ line-height:1.35; }
      .pp-ne .pp-gift-name, .pp-ne .pp-next-label, .pp-ne .pp-greeting{ line-height:1.45; }
      .pp-ne .pp-lede, .pp-ne .pp-gift-need{ font-size:16px; }
      .pp-ne .pp-submit, .pp-ne .pp-again, .pp-ne .pp-lang{ font-weight:600; }

      @media (max-width: 420px){
        .pp-card{ padding:24px 20px; border-radius:24px; }
        .pp-title{ font-size:30px; }
        .pp-ne .pp-title{ font-size:27px; }
        .pp-total-number{ font-size:62px; }
        .pp-gift-state{ font-size:13.5px; max-width:38%; }
      }

      @media (prefers-reduced-motion: reduce){
        .pp-enter, .pp-gift, .pp-bar-fill{ animation:none!important; }
        .pp-submit, .pp-again, .pp-lang, .pp-input{ transition:none!important; }
      }
    `}</style>
  );
}
