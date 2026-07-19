"use client";
import { useEffect, useRef } from "react";

/** A soft light that follows the cursor within its parent section. Purely decorative. */
export default function HeroGlow() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const parent = ref.current?.parentElement; if (!parent) return;
    const move = (e: MouseEvent) => {
      const r = parent.getBoundingClientRect();
      if (ref.current) {
        ref.current.style.setProperty("--gx", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--gy", `${e.clientY - r.top}px`);
        ref.current.style.opacity = "1";
      }
    };
    const leave = () => { if (ref.current) ref.current.style.opacity = "0"; };
    parent.addEventListener("mousemove", move);
    parent.addEventListener("mouseleave", leave);
    return () => { parent.removeEventListener("mousemove", move); parent.removeEventListener("mouseleave", leave); };
  }, []);
  return (
    <div ref={ref} aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500"
      style={{ background: "radial-gradient(420px circle at var(--gx,50%) var(--gy,30%), rgb(var(--glow) / 0.18), transparent 65%)" }} />
  );
}
