import { useState } from "react";
import { Flame, Star, Eye, BarChart2, MoreHorizontal, Plus } from "lucide-react";
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
      icon: <Star size={18} className="text-yellow-400" fill="currentColor" />,
    },
    {
      id: "prediction" as Tab,
      label: "Predict",
      icon: <Eye size={18} className="text-purple-400" />,
    },
    {
      id: "poll" as Tab,
      label: "Poll",
      icon: <BarChart2 size={18} className="text-green-400" />,
    },
    {
      id: null as Tab,
      label: "More",
      icon: <MoreHorizontal size={18} className="text-gray-400" />,
    },
  ];

  return (
    <>
      <div className="rounded-2xl mb-4 overflow-hidden bg-transparent">
        <p className="text-[10px] font-bold tracking-widest text-purple-400 uppercase px-4 pt-4 pb-3">
          What's your move?
        </p>

        <div className="flex gap-3 px-3 pb-4">
          {/* Featured Take tile */}
          <button
            onClick={() => open("hot_take")}
            className="relative flex-shrink-0 rounded-xl overflow-hidden flex flex-col justify-between p-4 active:opacity-80 transition-opacity"
            style={{
              width: "44%",
              minHeight: 120,
              background: "linear-gradient(135deg, #f97316, #ec4899)",
            }}
          >
            <span
              className="self-start text-[9px] font-bold tracking-widest uppercase rounded-full px-2.5 py-1"
              style={{ background: "rgba(255,255,255,0.2)", color: "#fff" }}
            >
              ★ Most Popular
            </span>
            <div className="flex items-end justify-between mt-3">
              <div className="text-left">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Flame size={18} className="text-white" />
                  <span className="text-white font-bold text-base leading-tight">Take</span>
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center ml-2 shrink-0">
                <Plus size={14} className="text-white" />
              </div>
            </div>
          </button>

          {/* 2×2 grid */}
          <div className="flex-1 grid grid-cols-2 gap-2">
            {tiles.map((tile) => (
              <button
                key={tile.label}
                onClick={() => open(tile.id)}
                className="rounded-xl px-3 py-2.5 flex flex-col gap-1.5 active:opacity-70 transition-opacity text-left"
                style={{ background: "#1e1244" }}
              >
                {tile.icon}
                <p className="text-white font-semibold text-[13px] leading-tight">{tile.label}</p>
              </button>
            ))}
          </div>
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
