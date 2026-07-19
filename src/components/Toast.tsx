"use client";
import { createContext, useContext, useCallback, useState, ReactNode } from "react";
import { IconCircleCheck, IconAlertCircle, IconInfoCircle } from "@tabler/icons-react";

type Toast = { id: number; msg: string; tone: "info" | "success" | "error" };
type Ctx = { toast: (msg: string, tone?: Toast["tone"]) => void };
const ToastCtx = createContext<Ctx>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

let seed = 0;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((msg: string, tone: Toast["tone"] = "info") => {
    const id = ++seed;
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`animate-fadein pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[12.5px] shadow-xl backdrop-blur ${
            t.tone === "success" ? "border-green/40 bg-green/10 text-green" : t.tone === "error" ? "border-rust/40 bg-rust/10 text-rust" : "border-border bg-panel text-text"
          }`}>
            {t.tone === "success" ? <IconCircleCheck size={16} stroke={1.8} /> : t.tone === "error" ? <IconAlertCircle size={16} stroke={1.8} /> : <IconInfoCircle size={16} stroke={1.8} />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
