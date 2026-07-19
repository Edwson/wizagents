"use client";

import Link from "next/link";
import { useEffect } from "react";
import { IconAlertTriangle, IconRefresh, IconHome } from "@tabler/icons-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface for diagnostics; kept minimal and dependency-free.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[65vh] items-center justify-center py-10">
      <div className="glass-card w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-rust/40 bg-rust/10 text-rust">
          <IconAlertTriangle size={24} stroke={1.7} />
        </div>
        <h1 className="font-display text-[20px] font-bold text-text">Something went wrong</h1>
        <p className="mt-1 text-[12.5px] text-muted">問題が発生しました · 發生了一些問題</p>
        <p className="mt-3 text-[13px] leading-6 text-muted">
          An unexpected error interrupted this page. You can try again, or head back to safety.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-[11px] text-faint">ref: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple bg-purple px-4 py-2 text-[13px] text-white transition-colors hover:bg-purpledim"
          >
            <IconRefresh size={15} stroke={1.7} /> Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2 text-[13px] text-text transition-colors hover:border-borderlight hover:bg-panel2"
          >
            <IconHome size={15} stroke={1.7} /> Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
