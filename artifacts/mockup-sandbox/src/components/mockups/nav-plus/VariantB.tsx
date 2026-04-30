export default function VariantB() {
  const items = [
    { label: "Now", icon: "⚡" },
    { label: "Play", icon: "🎲" },
  ];
  const after = [
    { label: "Library", icon: "📚" },
    { label: "Rooms", icon: "🚪" },
  ];
  return (
    <div className="w-[390px] h-[140px] flex flex-col justify-end" style={{ background: "linear-gradient(to bottom, #0a0a0f, #12121f)" }}>
      <nav className="flex justify-around items-center px-2 pb-4 pt-2" style={{ background: "linear-gradient(to right, #0a0a0f, #12121f, #2d1f4e)" }}>
        {items.map((item) => (
          <button key={item.label} className="flex flex-col items-center gap-0.5 opacity-50">
            <span className="text-[22px] leading-none">{item.icon}</span>
            <span className="text-white text-[10px]">{item.label}</span>
          </button>
        ))}

        {/* Variant B: Solid pill / capsule */}
        <button className="flex flex-col items-center gap-0.5">
          <div
            className="h-[30px] px-4 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}
          >
            <span className="text-white text-[18px] font-light leading-none">+</span>
          </div>
          <span className="text-white/0 text-[10px]">.</span>
        </button>

        {after.map((item) => (
          <button key={item.label} className="flex flex-col items-center gap-0.5 opacity-50">
            <span className="text-[22px] leading-none">{item.icon}</span>
            <span className="text-white text-[10px]">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
