import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

/* ---------------------------------------------------------------
   DocuMind — Home
   Self-contained: no external component libraries, no icon packs.
   Fonts pulled from Google Fonts. Everything else is hand-rolled.
----------------------------------------------------------------*/

const SOURCE_CARDS = [
  { label: "Quarterly_Report.pdf", top: "4%", left: "0%", rotate: -7 },
  { label: "docs.yourcompany.com", top: "0%", left: "60%", rotate: 5 },
  { label: "Meeting_Notes.docx", top: "60%", left: "-2%", rotate: 6 },
  { label: "vendor_terms.csv", top: "68%", left: "64%", rotate: -4 },
];

const SOURCE_LINE_PATHS = [
  "M 6 12 Q 30 34 48 50",
  "M 70 6 Q 55 30 50 48",
  "M 8 68 Q 28 55 48 52",
  "M 76 74 Q 58 58 52 50",
];

const STEPS = [
  {
    n: "01",
    title: "Point it at something",
    body: "Drop in a file or paste a URL. DocuMind fetches, parses, and breaks it into passages in the background — no formatting cleanup required on your end.",
  },
  {
    n: "02",
    title: "It builds a memory",
    body: "Every passage is indexed by meaning, not just keywords, so a question phrased nothing like the source text still finds the right paragraph.",
  },
  {
    n: "03",
    title: "You just ask",
    body: "Chat with it like a colleague who actually read the thing. Every answer comes with a citation back to the exact source it pulled from.",
  },
];

const SPECIMENS = [
  {
    big: true,
    title: "Answers with receipts",
    body: "Every reply links back to the exact page, paragraph, or row it came from, so you can check it in one click instead of taking the model's word for it.",
  },
  {
    title: "Reads the whole shelf",
    body: "Feed it a folder or a dozen tabs at once — DocuMind treats them as one connected memory, not twenty separate uploads.",
  },
  {
    title: "Scrapes the messy web",
    body: "Point it at a URL and it pulls the actual content, stripped of nav bars, cookie banners, and ads.",
  },
  {
    title: "Remembers the thread",
    body: "Ask a follow-up three questions later and it still knows what \u201cthe third clause\u201d referred to.",
  },
  {
    title: "Speaks your format",
    body: "PDF, DOCX, TXT, Markdown, CSV, PPTX, or pasted text — all normalized into the same searchable memory.",
  },
];

const CHAT_SCRIPT = [
  {
    role: "user",
    text: "What does section 4.2 of the vendor agreement say about refunds?",
  },
  {
    role: "ai",
    text: "Refunds are allowed within 30 days of delivery if the item is unopened and the request includes the original invoice number.",
    source: "Vendor_Agreement.pdf \u00b7 p. 3",
  },
  {
    role: "user",
    text: "And if it's a subscription instead of a one-time purchase?",
  },
  {
    role: "ai",
    text: "Subscriptions fall under section 6.1 \u2014 you can cancel anytime, but refunds only apply to the current billing cycle, not past ones.",
    source: "Vendor_Agreement.pdf \u00b7 p. 5",
  },
];

const FORMATS = ["PDF", "DOCX", "TXT", "Markdown", "CSV", "PPTX", "Web URL", "Pasted text"];

export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [navSolid, setNavSolid] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [chatStep, setChatStep] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const chatRef = useRef(null);
  const chatStarted = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('me/').then(() => setIsLoggedIn(true)).catch(() => setIsLoggedIn(false));
  }, []);

  const handleCta = useCallback(() => {
    navigate(isLoggedIn ? '/dashboard' : '/register');
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        setNavSolid(window.scrollY > 40);
        raf = null;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      setMouse({
        x: e.clientX / window.innerWidth - 0.5,
        y: e.clientY / window.innerHeight - 0.5,
      });
    };
    window.addEventListener("mousemove", onMove);
    const t = setTimeout(() => setHeroReady(true), 120);
    return () => {
      window.removeEventListener("mousemove", onMove);
      clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !chatStarted.current) {
            chatStarted.current = true;
            CHAT_SCRIPT.forEach((_, i) => {
              setTimeout(() => setChatStep(i + 1), 500 + i * 950);
            });
          }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goTo = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const prefersMotion = typeof window !== "undefined";

  return (
    <div className="dm-root">
      <style>{CSS}</style>

      <nav className={`dm-nav ${navSolid ? "dm-nav--solid" : ""}`}>
        <a href="#top" className="dm-brand" onClick={goTo("top")}>
          <svg viewBox="0 0 28 28" className="dm-brand-mark" aria-hidden="true">
            <rect x="5" y="3" width="15" height="20" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <rect x="9" y="7" width="15" height="20" rx="2.4" fill="var(--paper)" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="19.2" cy="12.4" r="1.4" fill="var(--brass)" />
          </svg>
          <span>DocuMind</span>
        </a>
        <div className="dm-nav-links">
          <a href="#how" onClick={goTo("how")}>How it works</a>
          <a href="#specimens" onClick={goTo("specimens")}>What it does</a>
          <a href="#chat-demo" onClick={goTo("chat-demo")}>See it talk</a>
        </div>
        <button className="dm-btn dm-btn--small" onClick={isLoggedIn ? () => navigate('/dashboard') : goTo("cta")}>{isLoggedIn ? 'Go to Dashboard' : 'Get started'}</button>
      </nav>

      <header id="top" className="dm-hero">
        <div className="dm-hero-grain" aria-hidden="true" />
        <div className="dm-hero-copy">
          <h1 className={`dm-h1 ${heroReady ? "dm-h1--in" : ""}`}>
            <span className="dm-h1-line">
              <span>Hand it your files.</span>
            </span>
            <span className="dm-h1-line dm-h1-line--2">
              <span>It hands back answers.</span>
            </span>
          </h1>
          <p className={`dm-sub ${heroReady ? "dm-sub--in" : ""}`}>
            DocuMind reads your PDFs, spreadsheets, and any page you point it at, then sits down
            and talks through what it found \u2014 with the receipts to back it up. No more re-reading
            a forty page report to find one paragraph.
          </p>
          <div className={`dm-hero-actions ${heroReady ? "dm-sub--in" : ""}`}>
            <button className="dm-btn dm-btn--primary" onClick={isLoggedIn ? () => navigate('/dashboard') : goTo("cta")}>Start reading</button>
            <button className="dm-btn dm-btn--ghost" onClick={goTo("chat-demo")}>Watch it work</button>
          </div>
        </div>

        <div
          className="dm-hero-visual"
          style={{
            transform: `translate3d(${mouse.x * 14}px, ${scrollY * 0.12 + mouse.y * 14}px, 0)`,
          }}
        >
          <svg className="dm-hero-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {SOURCE_LINE_PATHS.map((d, i) => (
              <path key={i} d={d} className="dm-flow-path" style={{ animationDelay: `${i * 0.5}s` }} />
            ))}
          </svg>

          <div className="dm-orb">
            <div className="dm-orb-core" />
            <div className="dm-orb-ring" />
          </div>

          {SOURCE_CARDS.map((c, i) => (
            <div
              key={c.label}
              className={`dm-float-card ${heroReady ? "dm-float-card--in" : ""}`}
              style={{
                top: c.top,
                left: c.left,
                "--rot": `${c.rotate}deg`,
                transitionDelay: `${i * 0.12 + 0.15}s`,
                animationDelay: `${i * 0.6}s`,
              }}
            >
              <svg viewBox="0 0 16 16" className="dm-float-card-icon" aria-hidden="true">
                <rect x="2" y="1.5" width="12" height="13" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <line x1="4.5" y1="5" x2="11.5" y2="5" stroke="currentColor" strokeWidth="1" />
                <line x1="4.5" y1="7.5" x2="11.5" y2="7.5" stroke="currentColor" strokeWidth="1" />
                <line x1="4.5" y1="10" x2="9" y2="10" stroke="currentColor" strokeWidth="1" />
              </svg>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </header>

      <section className="dm-strip">
        <div className="dm-strip-label">Drop in almost anything</div>
        <div className="dm-marquee">
          <div className="dm-marquee-track">
            {[...FORMATS, ...FORMATS].map((f, i) => (
              <span className="dm-chip" key={i}>{f}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="dm-how">
        <h2 className="dm-h2">From a pile of files to a conversation</h2>
        <div className="dm-steps">
          {STEPS.map((s, i) => (
            <div className="dm-step" key={s.n}>
              <div className="dm-step-num">{s.n}</div>
              <div className="dm-step-body">
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
              {i < STEPS.length - 1 && <div className="dm-step-line" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      <section id="specimens" className="dm-specimens">
        <h2 className="dm-h2">What's actually going on under the hood</h2>
        <div className="dm-specimen-grid">
          {SPECIMENS.map((s, i) => (
            <div
              key={s.title}
              className={`dm-card ${s.big ? "dm-card--big" : ""}`}
              style={{
                transform: `translate3d(0, ${Math.max(-24, Math.min(24, (scrollY - 900) * (0.02 + i * 0.006) * -1))}px, 0)`,
              }}
            >
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="chat-demo" className="dm-demo" ref={chatRef}>
        <div className="dm-demo-copy">
          <h2 className="dm-h2">Ask it like you'd ask a person</h2>
          <p className="dm-demo-sub">
            Not a search bar that returns ten blue links. A conversation that remembers what you
            already talked about, and shows its work.
          </p>
        </div>
        <div className="dm-notebook">
          <div className="dm-notebook-bar">
            <span className="dm-dot" /><span className="dm-dot" /><span className="dm-dot" />
            <span className="dm-notebook-title">Vendor_Agreement.pdf</span>
          </div>
          <div className="dm-chat">
            {CHAT_SCRIPT.slice(0, chatStep).map((m, i) => (
              <div key={i} className={`dm-msg dm-msg--${m.role}`}>
                <p>{m.text}</p>
                {m.source && <span className="dm-source-chip">{m.source}</span>}
              </div>
            ))}
            {chatStep > 0 && chatStep < CHAT_SCRIPT.length && (
              <div className="dm-msg dm-msg--ai dm-msg--typing">
                <span /><span /><span />
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="cta" className="dm-cta">
        <h2 className="dm-cta-h">Stop skimming. Start asking.</h2>
        <p>Bring your first file or a link you keep meaning to read properly.</p>
        <button className="dm-btn dm-btn--primary dm-btn--large" onClick={handleCta}>{isLoggedIn ? 'Go to Dashboard' : 'Try DocuMind free'}</button>
      </section>

      <footer className="dm-footer">
        <div className="dm-brand dm-brand--footer">
          <svg viewBox="0 0 28 28" className="dm-brand-mark" aria-hidden="true">
            <rect x="5" y="3" width="15" height="20" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <rect x="9" y="7" width="15" height="20" rx="2.4" fill="var(--paper)" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="19.2" cy="12.4" r="1.4" fill="var(--brass)" />
          </svg>
          <span>DocuMind</span>
        </div>
        <p className="dm-footer-note">Built for people who have too many tabs open and not enough time to read them.</p>
      </footer>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,340;0,9..144,440;0,9..144,600;1,9..144,440&family=Space+Grotesk:wght@400;500;600;700&display=swap');

.dm-root {
  --paper: #F4F1EA;
  --paper-warm: #FAF8F5;
  --ink: #16233D;
  --ink-soft: #48566E;
  --ink-faint: #7E8C9F;
  --brass: #9E6F1D;
  --brass-soft: #EFE4CE;
  --moss: #335940;
  --line: #D8D4CA;
  --shadow: rgba(22, 35, 61, 0.08);

  background: var(--paper);
  color: var(--ink);
  font-family: 'Space Grotesk', -apple-system, sans-serif;
  overflow-x: hidden;
  position: relative;
}

.dm-root :where(h1, h2, h3) {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 440;
  color: var(--ink);
  margin: 0;
  letter-spacing: -0.01em;
}

.dm-root, .dm-root * { box-sizing: border-box; }
.dm-root a { color: inherit; text-decoration: none; }
.dm-root button { font-family: inherit; cursor: pointer; }
.dm-root :focus-visible { outline: 2px solid var(--brass); outline-offset: 3px; }

.dm-hero-grain {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  pointer-events: none;
  background-image: radial-gradient(rgba(22,35,61,0.05) 1px, transparent 1px);
  background-size: 3px 3px;
}

/* ---------- Nav ---------- */
.dm-nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 18px 48px;
  background: transparent;
  transition: background 0.35s ease, box-shadow 0.35s ease, padding 0.35s ease;
}
.dm-nav--solid {
  background: rgba(232, 236, 238, 0.86);
  backdrop-filter: blur(10px);
  box-shadow: 0 1px 0 var(--line);
  padding: 12px 48px;
}
.dm-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: 'Fraunces', serif;
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--ink);
}
.dm-brand-mark { width: 26px; height: 26px; color: var(--ink); flex-shrink: 0; }
.dm-nav-links { display: flex; gap: 32px; }
.dm-nav-links a { font-size: 0.94rem; color: var(--ink-soft); transition: color 0.2s ease; }
.dm-nav-links a:hover { color: var(--ink); }

.dm-btn {
  border-radius: 999px;
  border: 1.4px solid var(--ink);
  padding: 11px 22px;
  font-size: 0.94rem;
  font-weight: 500;
  background: transparent;
  color: var(--ink);
  transition: background 0.2s ease, color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
}
.dm-btn--small { padding: 8px 18px; font-size: 0.88rem; }
.dm-btn--primary { background: var(--ink); color: var(--paper-warm); }
.dm-btn--primary:hover { transform: translateY(-1.5px); box-shadow: 0 8px 20px var(--shadow); }
.dm-btn--ghost { border-color: var(--line); color: var(--ink-soft); }
.dm-btn--ghost:hover { border-color: var(--ink); color: var(--ink); }
.dm-btn--large { padding: 15px 32px; font-size: 1.02rem; }

/* ---------- Hero ---------- */
.dm-hero {
  position: relative;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  align-items: center;
  gap: 24px;
  padding: 64px 48px 120px;
  min-height: 82vh;
}
.dm-hero-copy { position: relative; z-index: 2; max-width: 620px; }

.dm-h1 {
  font-size: clamp(2.6rem, 5.2vw, 4.4rem);
  line-height: 1.06;
}
.dm-h1-line { display: block; overflow: hidden; }
.dm-h1-line span {
  display: block;
  transform: translateY(105%);
  transition: transform 0.9s cubic-bezier(0.16, 1, 0.3, 1);
}
.dm-h1--in .dm-h1-line span { transform: translateY(0); }
.dm-h1--in .dm-h1-line--2 span { transition-delay: 0.1s; }

.dm-sub {
  margin-top: 26px;
  font-size: 1.12rem;
  line-height: 1.6;
  color: var(--ink-soft);
  max-width: 46ch;
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s;
}
.dm-sub--in { opacity: 1; transform: translateY(0); }

.dm-hero-actions {
  display: flex;
  gap: 14px;
  margin-top: 34px;
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.7s ease 0.65s, transform 0.7s ease 0.65s;
}

.dm-hero-visual {
  position: relative;
  height: 520px;
  will-change: transform;
}
.dm-hero-lines { position: absolute; inset: 0; width: 100%; height: 100%; }
.dm-flow-path {
  fill: none;
  stroke: var(--brass);
  stroke-width: 0.5;
  stroke-dasharray: 3 3;
  opacity: 0.55;
  animation: dm-dash 5s linear infinite;
}
@keyframes dm-dash { to { stroke-dashoffset: -60; } }

.dm-orb {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 150px;
  height: 150px;
}
.dm-orb-core {
  position: absolute;
  inset: 18px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fff6df, var(--brass-soft) 40%, var(--brass) 100%);
  box-shadow: 0 18px 46px var(--shadow);
  animation: dm-pulse 4.5s ease-in-out infinite;
}
.dm-orb-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid var(--brass);
  opacity: 0.35;
  animation: dm-ring 4.5s ease-in-out infinite;
}
@keyframes dm-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.06); }
}
@keyframes dm-ring {
  0% { transform: scale(0.9); opacity: 0.5; }
  100% { transform: scale(1.35); opacity: 0; }
}

.dm-float-card {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--paper-warm);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.82rem;
  color: var(--ink-soft);
  box-shadow: 0 10px 26px var(--shadow);
  transform: rotate(var(--rot)) translateY(18px) scale(0.94);
  opacity: 0;
  transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
  animation: dm-bob 6s ease-in-out infinite;
  max-width: 210px;
}
.dm-float-card-icon { width: 16px; height: 16px; flex-shrink: 0; color: var(--brass); }
.dm-float-card--in { opacity: 1; transform: rotate(var(--rot)) translateY(0) scale(1); }
@keyframes dm-bob {
  0%, 100% { margin-top: 0px; }
  50% { margin-top: -9px; }
}

/* ---------- Source strip ---------- */
.dm-strip {
  padding: 34px 0 46px;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}
.dm-strip-label { text-align: center; color: var(--ink-faint); font-size: 0.88rem; margin-bottom: 18px; }
.dm-marquee { overflow: hidden; }
.dm-marquee-track {
  display: flex;
  gap: 14px;
  width: max-content;
  animation: dm-scroll 26s linear infinite;
}
.dm-marquee:hover .dm-marquee-track { animation-play-state: paused; }
@keyframes dm-scroll { to { transform: translateX(-50%); } }
.dm-chip {
  flex-shrink: 0;
  border: 1px solid var(--line);
  background: var(--paper-warm);
  border-radius: 999px;
  padding: 9px 20px;
  font-size: 0.9rem;
  color: var(--ink-soft);
}

/* ---------- How it works ---------- */
.dm-how { padding: 110px 48px; max-width: 980px; margin: 0 auto; }
.dm-h2 { font-size: clamp(1.7rem, 3vw, 2.3rem); margin-bottom: 56px; max-width: 18ch; }
.dm-steps { display: flex; flex-direction: column; }
.dm-step { position: relative; display: flex; gap: 32px; padding-bottom: 56px; }
.dm-step:last-child { padding-bottom: 0; }
.dm-step-num {
  font-family: 'Fraunces', serif;
  font-size: 1.3rem;
  color: var(--brass);
  width: 46px;
  flex-shrink: 0;
}
.dm-step-body h3 { font-size: 1.3rem; margin-bottom: 10px; }
.dm-step-body p { color: var(--ink-soft); line-height: 1.65; max-width: 56ch; }
.dm-step-line {
  position: absolute;
  left: 22px;
  top: 34px;
  bottom: 4px;
  width: 1px;
  background: var(--line);
}

/* ---------- Specimens ---------- */
.dm-specimens { padding: 60px 48px 120px; max-width: 1180px; margin: 0 auto; }
.dm-specimen-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 18px;
}
.dm-card {
  background: var(--paper-warm);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 28px;
  grid-column: span 3;
}
.dm-card--big {
  grid-column: span 4;
  background: var(--ink);
  color: var(--paper-warm);
  border-color: var(--ink);
}
.dm-card--big h3, .dm-card--big p { color: var(--paper-warm); }
.dm-specimen-grid .dm-card:nth-child(2) { grid-column: span 2; }
.dm-specimen-grid .dm-card:nth-child(3) { grid-column: span 3; }
.dm-specimen-grid .dm-card:nth-child(4) { grid-column: span 3; }
.dm-specimen-grid .dm-card:nth-child(5) { grid-column: span 3; }
.dm-card h3 { font-size: 1.18rem; margin-bottom: 12px; }
.dm-card p { color: var(--ink-soft); line-height: 1.6; font-size: 0.96rem; }

/* ---------- Chat demo ---------- */
.dm-demo {
  padding: 40px 48px 130px;
  max-width: 1080px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: 56px;
  align-items: start;
}
.dm-demo-sub { color: var(--ink-soft); margin-top: 18px; line-height: 1.65; max-width: 40ch; }
.dm-notebook {
  background: var(--paper-warm);
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 30px 60px var(--shadow);
}
.dm-notebook-bar {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}
.dm-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--line); }
.dm-notebook-title { margin-left: 10px; font-size: 0.82rem; color: var(--ink-faint); }
.dm-chat { padding: 24px; min-height: 320px; display: flex; flex-direction: column; gap: 16px; }
.dm-msg { max-width: 82%; padding: 13px 16px; border-radius: 14px; font-size: 0.94rem; line-height: 1.55; }
.dm-msg--user { align-self: flex-end; background: var(--ink); color: var(--paper-warm); border-bottom-right-radius: 4px; }
.dm-msg--ai { align-self: flex-start; background: var(--paper); border: 1px solid var(--line); border-bottom-left-radius: 4px; display: flex; flex-direction: column; gap: 8px; }
.dm-msg p { margin: 0; }
.dm-source-chip {
  align-self: flex-start;
  font-size: 0.76rem;
  color: var(--moss);
  background: rgba(71, 98, 79, 0.1);
  border-radius: 999px;
  padding: 4px 10px;
}
.dm-msg--typing { display: flex; flex-direction: row; gap: 5px; padding: 16px; align-items: center; }
.dm-msg--typing span {
  width: 6px; height: 6px; border-radius: 50%; background: var(--ink-faint);
  animation: dm-typing 1.2s ease-in-out infinite;
}
.dm-msg--typing span:nth-child(2) { animation-delay: 0.15s; }
.dm-msg--typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes dm-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

/* ---------- CTA ---------- */
.dm-cta {
  text-align: center;
  padding: 110px 24px 130px;
  border-top: 1px solid var(--line);
}
.dm-cta-h { font-size: clamp(2rem, 4vw, 2.8rem); margin-bottom: 16px; }
.dm-cta p { color: var(--ink-soft); margin-bottom: 34px; }

/* ---------- Footer ---------- */
.dm-footer {
  padding: 40px 48px 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: var(--ink-faint);
  text-align: center;
}
.dm-brand--footer { color: var(--ink-soft); font-size: 1.05rem; }
.dm-footer-note { font-size: 0.86rem; }

/* ---------- Responsive ---------- */
@media (max-width: 960px) {
  .dm-hero { grid-template-columns: 1fr; padding: 40px 24px 80px; }
  .dm-hero-visual { height: 380px; order: -1; margin-bottom: 24px; }
  .dm-nav { padding: 16px 24px; }
  .dm-nav-links { display: none; }
  .dm-how, .dm-specimens, .dm-demo, .dm-cta { padding-left: 24px; padding-right: 24px; }
  .dm-demo { grid-template-columns: 1fr; gap: 32px; }
  .dm-specimen-grid { grid-template-columns: repeat(2, 1fr); }
  .dm-card, .dm-card--big, .dm-specimen-grid .dm-card:nth-child(2),
  .dm-specimen-grid .dm-card:nth-child(3),
  .dm-specimen-grid .dm-card:nth-child(4),
  .dm-specimen-grid .dm-card:nth-child(5) { grid-column: span 2; }
}
@media (max-width: 560px) {
  .dm-hero-actions { flex-direction: column; }
  .dm-specimen-grid { grid-template-columns: 1fr; }
  .dm-card, .dm-card--big { grid-column: span 1 !important; }
}

@media (prefers-reduced-motion: reduce) {
  .dm-root *, .dm-root *::before, .dm-root *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
  }
  .dm-hero-visual { transform: none !important; }
}
`;
