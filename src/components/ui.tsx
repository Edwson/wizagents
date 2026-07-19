"use client";
import Link from "next/link";
import { catLabel } from "@/lib/categories";
import { ReactNode, useEffect, useRef } from "react";

/* ---------------- Glass surfaces ---------------- */
export function Panel({ children, className = "", pad = true, glow = false }: { children: ReactNode; className?: string; pad?: boolean; glow?: boolean }) {
  return <div className={`glass-card ${pad ? "p-5" : ""} ${glow ? "glow" : ""} ${className}`}>{children}</div>;
}

export function GlassCard({ children, className = "", pad = true, grad = false }: { children: ReactNode; className?: string; pad?: boolean; grad?: boolean }) {
  return <div className={`glass-card ${grad ? "border-grad" : ""} ${pad ? "p-5" : ""} ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "amber" | "purple" | "green" | "rust" | "cyan" }) {
  const tones: Record<string, string> = {
    muted: "border-border/70 text-muted",
    amber: "border-amber/40 text-amber",
    purple: "border-purple/40 text-purple",
    green: "border-green/40 text-green",
    rust: "border-rust/40 text-rust",
    cyan: "border-cyan/40 text-cyan",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border bg-panel/40 px-2 py-0.5 text-[10.5px] leading-none backdrop-blur-sm ${tones[tone]}`}>{children}</span>;
}

export function CatBadge({ cat }: { cat: string }) { return <Badge tone="muted">{catLabel(cat)}</Badge>; }

export function Dot({ color = "rgb(var(--glow))", pulse = false }: { color?: string; pulse?: boolean }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${pulse ? "animate-pulsedot" : ""}`} style={{ background: color, boxShadow: `0 0 8px ${color}` }} />;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="glass-card p-4">
      <div className="text-[11px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-text">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

/* ---------------- Buttons (magnetic glow) ---------------- */
export function Btn({
  children, href, variant = "primary", size = "md", className = "", type = "button", ...rest
}: {
  children: ReactNode; href?: string;
  variant?: "primary" | "ghost" | "outline" | "amber" | "danger";
  size?: "sm" | "md" | "lg"; className?: string; type?: "button" | "submit";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const variants: Record<string, string> = {
    primary: "bg-purple text-white border border-purple hover:bg-purpledim",
    amber: "bg-purple text-white border border-purple font-semibold hover:bg-purpledim",
    outline: "border border-border text-text hover:border-borderlight hover:bg-panel2 bg-transparent",
    ghost: "text-muted hover:text-text bg-transparent border border-transparent hover:bg-panel2",
    danger: "border border-rust/40 text-rust hover:bg-rust/10 bg-transparent",
  };
  const sizes: Record<string, string> = {
    sm: "px-3 py-1.5 text-[12px]", md: "px-4 py-2 text-[13px]", lg: "px-5 py-2.5 text-[14px]",
  };
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg transition-colors duration-150 ${variants[variant]} ${sizes[size]} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type={type} className={cls} {...rest}>{children}</button>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-faint"><span className="inline-block h-px w-6 bg-border" />{children}</div>;
}

export function Progress({ value, tone }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel3">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: tone || "rgb(var(--purple))" }} />
    </div>
  );
}

export function GradientText({ children, className = "", neon = false }: { children: ReactNode; className?: string; neon?: boolean }) {
  return <span className={`${neon ? "text-grad-neon" : "text-grad"} ${className}`}>{children}</span>;
}

/* ---------------- Background: aurora + grid + noise ---------------- */
export function Aurora() {
  return (
    <>
      <div className="aurora-bg" aria-hidden />
      <div className="aurora-orb" aria-hidden />
      <div className="grid-overlay" aria-hidden />
      <div className="noise-overlay" aria-hidden />
    </>
  );
}

/* ---------------- Scroll reveal ---------------- */
export function Reveal({ children, className = "", delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delay?: number; as?: any }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { setTimeout(() => el.classList.add("in"), delay); io.unobserve(el); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    io.observe(el); return () => io.disconnect();
  }, [delay]);
  return <Tag ref={ref as any} className={`reveal ${className}`}>{children}</Tag>;
}

/* ---------------- Magnetic wrapper (cursor-reactive) ---------------- */
export function Magnetic({ children, className = "" }: { children: ReactNode; className?: string; strength?: number }) {
  return <div className={className}>{children}</div>;
}
