"use client";
import Link from "next/link";
import { IconCircleCheck, IconCircle, IconArrowRight } from "@tabler/icons-react";
import { Btn, Progress } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

type Tri = [string, string, string];

export type OnboardingStep = {
  done: boolean;
  label: Tri;
  desc: Tri;
  cta: Tri;
  href?: string;
  onClick?: () => void;
};

export default function OnboardingChecklist({
  role,
  steps,
  onDismiss,
}: {
  role: string;
  steps: OnboardingStep[];
  onDismiss?: () => void;
}) {
  const { t } = useI18n();
  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.done).length;
  // Once everything is done, disappear entirely.
  if (doneCount === steps.length) return null;

  const pct = Math.round((doneCount / steps.length) * 100);
  const firstOpen = steps.findIndex((s) => !s.done);

  return (
    <section className="glass-card p-5" aria-label={t("Get started", "はじめに", "開始使用")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[16px] font-bold tracking-tight">{t("Get started", "はじめに", "開始使用")}</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {t(
              `${doneCount} of ${steps.length} steps complete`,
              `${steps.length} 件中 ${doneCount} 件完了`,
              `已完成 ${doneCount} / ${steps.length} 步`
            )}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[11px] text-faint transition-colors hover:text-muted"
          >
            {t("Dismiss", "閉じる", "略過")}
          </button>
        )}
      </div>

      <div className="mt-3">
        <Progress value={pct} tone={doneCount === steps.length ? "rgb(var(--green))" : "rgb(var(--purple))"} />
      </div>

      <ol className="mt-4 space-y-1">
        {steps.map((s, i) => {
          const isFirstOpen = i === firstOpen;
          const label = t(s.label[0], s.label[1], s.label[2]);
          const desc = t(s.desc[0], s.desc[1], s.desc[2]);
          const cta = t(s.cta[0], s.cta[1], s.cta[2]);
          return (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-panel2/40"
            >
              <span className="mt-px shrink-0">
                {s.done ? (
                  <IconCircleCheck size={20} stroke={1.7} className="text-green" />
                ) : (
                  <IconCircle size={20} stroke={1.7} className="text-faint" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div
                  className={`font-display text-[13.5px] font-semibold leading-5 ${
                    s.done ? "text-faint line-through" : "text-text"
                  }`}
                >
                  {label}
                </div>
                <div className={`mt-0.5 text-[11.5px] leading-5 ${s.done ? "text-faint/70" : "text-muted"}`}>
                  {desc}
                </div>
              </div>

              {!s.done && (
                <div className="shrink-0 self-center">
                  {isFirstOpen ? (
                    <Btn
                      variant="primary"
                      size="sm"
                      href={s.href}
                      onClick={s.onClick}
                    >
                      {cta} <IconArrowRight size={14} stroke={1.7} />
                    </Btn>
                  ) : s.href ? (
                    <Link
                      href={s.href}
                      className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-text"
                    >
                      {cta} <IconArrowRight size={13} stroke={1.7} />
                    </Link>
                  ) : (
                    <button
                      onClick={s.onClick}
                      className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-text"
                    >
                      {cta} <IconArrowRight size={13} stroke={1.7} />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
