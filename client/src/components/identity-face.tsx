// Neon DNA face avatar used in the identity card.
export function IdentityFace({
  size = 88,
  className = "",
  variant = "filled",
  content,
}: {
  size?: number;
  className?: string;
  variant?: "filled" | "outline";
  content?: React.ReactNode;
}) {
  const isOutline = variant === "outline";

  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: isOutline
            ? "radial-gradient(circle, rgba(168,85,247,0.15), transparent 72%)"
            : "radial-gradient(circle, rgba(168,85,247,0.35), transparent 72%)",
        }}
      />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: isOutline ? "2px solid rgba(192,132,252,0.8)" : "2px solid rgba(168,85,247,0.55)",
          boxShadow: isOutline
            ? "0 0 22px rgba(168,85,247,0.55), inset 0 0 12px rgba(168,85,247,0.08)"
            : "0 0 22px rgba(168,85,247,0.5), inset 0 0 22px rgba(168,85,247,0.22)",
          background: isOutline ? "rgba(24,15,45,0.12)" : "radial-gradient(circle at 50% 38%, rgba(64,44,98,0.6), rgba(20,15,35,0.85))",
        }}
      />
      {content ? (
        <div
          className="absolute inset-0 grid place-items-center"
          style={{ filter: "drop-shadow(0 0 4px rgba(192,132,252,0.9))" }}
        >
          {content}
        </div>
      ) : (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          style={{ filter: "drop-shadow(0 0 4px rgba(192,132,252,0.9))" }}
        >
          {/* peaceful closed eyes */}
          <path d="M28 48 q7 -8 14 0" stroke="#c084fc" strokeWidth={isOutline ? 5 : 4} fill="none" strokeLinecap="round" />
          <path d="M58 48 q7 -8 14 0" stroke="#c084fc" strokeWidth={isOutline ? 5 : 4} fill="none" strokeLinecap="round" />
          {/* smile */}
          <path d="M34 62 q16 14 32 0" stroke="#c084fc" strokeWidth={isOutline ? 5 : 4} fill="none" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}
