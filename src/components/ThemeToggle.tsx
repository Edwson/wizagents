"use client";
import { useEffect, useState } from "react";
import { IconSun, IconMoon } from "@tabler/icons-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); setDark(document.documentElement.classList.contains("dark")); }, []);
  function toggle() {
    const d = !dark; setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("theme", d ? "dark" : "light"); } catch {}
  }
  return (
    <button onClick={toggle} aria-label="Theme" className="rounded-lg border border-border bg-panel2 px-2.5 py-1.5 text-muted hover:text-text">
      {mounted && dark ? <IconSun size={16} stroke={1.7} /> : <IconMoon size={16} stroke={1.7} />}
    </button>
  );
}
