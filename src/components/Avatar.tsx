/**
 * One avatar, everywhere. A photo when the person uploaded one, their colour + initial
 * when they haven't. Server-safe (no hooks), so it can be used in both server and client trees.
 */
export default function Avatar({
  name, color, mediaId, size = 28, className = "",
}: {
  name: string;
  color?: string | null;
  mediaId?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name || "?").trim().slice(0, 1).toUpperCase();
  const style = { width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.4)) };

  if (mediaId) {
    return (
      <img
        src={`/api/media/${mediaId}`}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        style={style}
        className={`shrink-0 rounded-full border border-border object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, backgroundColor: color || "#8b6dff" }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${className}`}
    >
      {initial}
    </span>
  );
}
