import { useState } from "react";
import { Flame, Star, Target, CheckSquare, MoreHorizontal } from "lucide-react";
import { QuickActionSheet } from "./quick-action-sheet";

type Tab = "hot_take" | "review" | "prediction" | "poll" | null;

export function WhatsYourMove() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(null);

  const open = (t: Tab) => { setTab(t); setIsOpen(true); };

  const tiles = [
    {
      id: "review" as Tab,
      label: "Rate",
      icon: <Star size={20} className="text-yellow-400" />,
    },
    {
      id: "prediction" as Tab,
      label: "Predict",
      icon: <Target size={20} className="text-red-400" />,
    },
    {
      id: "poll" as Tab,
      label: "Poll",
      icon: <CheckSquare size={20} className="text-blue-400" />,
    },
    {
      id: null as Tab,
      label: "More",
      sub: "Ranks, lists & more",
      icon: <MoreHorizontal size={20} className="text-white/60" />,
    },
  ];

  return (
    <>
      <div className="px-0 pb-1">
        <p className="text-[10px] font-bold tracking-widest text-purple-400 uppercase mb-2">
          What's your move?
        </p>

        <div className="flex gap-2">
          {/* Featured Take tile — wider */}
          <button
            onClick={() => open("hot_take")}
            className="relative flex-shrink-0 rounded-2xl overflow-hidden flex flex-col justify-between p-3 active:opacity-80 transition-opacity"
            style={{
              width: "30%",
              minHeight: 90,
              background: "linear-gradient(135deg, #f97316, #ec4899)",
            }}
          >
            <div className="flex items-center gap-1">
              <Flame size={16} className="text-white" />
              <span className="text-white font-bold text-sm leading-tight">Take</span>
            </div>
            <span
              className="self-start text-[8px] font-bold tracking-widest uppercase rounded-full px-2 py-0.5 mt-1"
              style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
            >
              ★ Most Popular
            </span>
          </button>

          {/* Flat tiles — single row */}
          {tiles.map((tile) => (
            <button
              key={tile.label}
              onClick={() => open(tile.id)}
              className="flex-1 rounded-2xl px-2 py-3 flex flex-col items-center justify-center gap-1 active:opacity-70 transition-opacity text-center"
              style={{ background: "#1e1244", minHeight: 90 }}
            >
              {tile.icon}
              <p className="text-white font-bold text-[12px] leading-tight">{tile.label}</p>
              {'sub' in tile && tile.sub && (
                <p className="text-white/45 text-[9px] leading-tight text-center">{tile.sub}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      <QuickActionSheet
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); setTab(null); }}
        preselectedIntent="capture"
        preselectedTab={tab}
      />
    </>
  );
}
