"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";
import { useI18n } from "@/lib/i18n";
import { IconHeart, IconHeartFilled } from "@tabler/icons-react";

export default function FavoriteButton({
  slug,
  initialFav = false,
  className = "",
}: {
  slug: string;
  initialFav?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const [fav, setFav] = useState(initialFav);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });

      if (res.status === 401) {
        toast(t("Please log in first","先にログインしてください","請先登入"));
        return;
      }

      const data = await res.json();
      if (!res.ok) return;

      setFav(data.favorited);
      toast(data.favorited ? t("Added to favorites","お気に入りに追加しました","已加入收藏") : t("Removed from favorites","お気に入りから削除しました","已移除收藏"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={fav}
      aria-label={fav ? t("Favorited","お気に入り済み","已收藏") : t("Add to favorites","お気に入りに追加","加入收藏")}
      title={fav ? t("Favorited","お気に入り済み","已收藏") : t("Add to favorites","お気に入りに追加","加入收藏")}
      className={`rounded-lg border border-border bg-panel2 px-2.5 py-1.5 hover:text-text ${
        fav ? "text-rust" : "text-muted"
      } ${className}`}
    >
      {fav ? <IconHeartFilled size={16} /> : <IconHeart size={16} stroke={1.7} />}
    </button>
  );
}
