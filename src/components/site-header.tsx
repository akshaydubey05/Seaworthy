"use client";

import { useState } from "react";
import { SeaworthyMark } from "@/components/brand";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#checks", label: "Checks" },
  { href: "#report", label: "Report" },
  { href: "#pricing", label: "Pricing" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(236,241,236,0.08)] bg-[#0f1411]/55 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-[#0f1411]/45">
      <div className="container flex h-[72px] items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-3" onClick={() => setOpen(false)} aria-label="Seaworthy home">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[linear-gradient(180deg,#b7cab7,var(--accent))] text-[#141814] shadow-[0_8px_24px_rgba(149,176,149,0.22),inset_0_1px_0_rgba(255,255,255,0.45)]">
            <SeaworthyMark className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[15px] font-medium tracking-[-0.01em]">Seaworthy</span>
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm text-[var(--muted)] md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="nav-link transition-colors hover:text-[var(--text)]">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a href="#scan" className="btn btn-primary !min-h-11 !px-4 !text-[13px]">Run fast scan</a>
          <button
            type="button"
            className="md:hidden btn btn-ghost !min-h-11 !w-11 !px-0"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        className={`md:hidden overflow-hidden border-t border-[var(--line)] bg-[#0f1411]/88 backdrop-blur-xl transition-[max-height,opacity] duration-300 ${open ? "max-h-72 opacity-100" : "max-h-0 opacity-0 border-transparent"}`}
      >
        <nav aria-label="Mobile" className="container flex flex-col py-3">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-2 py-3 text-sm text-[var(--muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--text)]"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}