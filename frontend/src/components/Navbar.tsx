"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { API_URL } from "@/lib/api";
import HealthDot from "./HealthDot";

const links = [
  { href: "/analyze", label: "Analyze" },
  { href: "/model", label: "Model" },
  { href: "/history", label: "History" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-stain-600 to-pink-500 text-sm font-bold text-white">
            DS
          </span>
          <span>
            DS-Net <span className="font-normal text-slate-400">Histopathology</span>
          </span>
        </Link>

        <button
          className="rounded-md p-2 text-slate-600 sm:hidden"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>

        <div
          className={`${open ? "flex" : "hidden"} absolute top-16 right-0 left-0 flex-col gap-1 border-b border-slate-200 bg-white p-4 sm:static sm:flex sm:flex-row sm:items-center sm:gap-1 sm:border-0 sm:bg-transparent sm:p-0`}
        >
          {links.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-stain-50 text-stain-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <a
            href={`${API_URL}/docs`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            API Docs ↗
          </a>
          <HealthDot />
        </div>
      </nav>
    </header>
  );
}
