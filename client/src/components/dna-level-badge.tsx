import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Star, Trophy, Lock, ChevronDown } from "lucide-react";

interface DNALevelBadgeProps {
  level: 1 | 2 | 3;
  itemCount: number;
  showProgress?: boolean;
  compact?: boolean;
}

const LEVEL_CONFIG = {
  1: {
    name: "DNA Snapshot",
    icon: Sparkles,
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    description: "Survey-based profile",
    nextUnlock: "Celebrity Matches",
    nextLevel: 2,
    threshold: 15,
  },
  2: {
    name: "DNA Profile",
    icon: Star,
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-100",
    textColor: "text-amber-700",
    description: "Behavior + Survey blend",
    nextUnlock: "Friend DNA Comparisons",
    nextLevel: 3,
    threshold: 30,
  },
  3: {
    name: "DNA Blueprint",
    icon: Trophy,
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-700",
    description: "Full behavior-driven",
    nextUnlock: null,
    nextLevel: null,
    threshold: null,
  },
};

export function DNALevelBadge({ level, itemCount, showProgress = true, compact = false }: DNALevelBadgeProps) {
  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;
  
  const nextThreshold = config.threshold;
  const itemsNeeded = nextThreshold ? Math.max(0, nextThreshold - itemCount) : 0;
  const progress = nextThreshold 
    ? Math.min(100, (itemCount / nextThreshold) * 100)
    : 100;

  if (compact) {
    return (
      <Badge className={`${config.bgColor} ${config.textColor} text-xs font-medium px-2 py-0.5`}>
        <Icon size={12} className="mr-1" />
        Level {level}: {config.name}
      </Badge>
    );
  }

  return (
    <div className="py-2">
      {/* Simple horizontal layout */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center shadow-md`}>
            <Icon className="text-white" size={18} />
          </div>
          <div>
            <div className="text-sm text-gray-500">Level {level}</div>
            <div className="font-semibold text-gray-900">{config.name}</div>
          </div>
        </div>
        
        {/* Progress or status */}
        <div className="text-right">
          {showProgress && nextThreshold ? (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs text-gray-500">{itemCount} of {nextThreshold}</div>
                <Progress value={progress} className="h-1.5 w-16" />
              </div>
              <ChevronDown size={16} className="text-gray-400" />
            </div>
          ) : level === 3 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-medium">All unlocked</span>
              <ChevronDown size={16} className="text-gray-400" />
            </div>
          ) : null}
        </div>
      </div>

      {/* Unlock hint */}
      {showProgress && nextThreshold && itemsNeeded > 0 && (
        <p className="text-xs text-gray-500 mt-2 pl-13">
          Log <span className="font-semibold text-purple-600">{itemsNeeded} more</span> to unlock {config.nextUnlock}
        </p>
      )}
    </div>
  );
}

export function DNALevelProgress({ itemCount }: { itemCount: number }) {
  const level = itemCount >= 30 ? 3 : itemCount >= 15 ? 2 : 1;
  
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${level >= 1 ? 'bg-purple-500' : 'bg-gray-300'}`} />
      <div className={`flex-1 h-1 ${level >= 2 ? 'bg-amber-500' : 'bg-gray-200'}`} />
      <div className={`w-2 h-2 rounded-full ${level >= 2 ? 'bg-amber-500' : 'bg-gray-300'}`} />
      <div className={`flex-1 h-1 ${level >= 3 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
      <div className={`w-2 h-2 rounded-full ${level >= 3 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    </div>
  );
}

export function DNAFeatureLock({ requiredLevel, currentLevel, currentItemCount, featureName }: { 
  requiredLevel: 2 | 3; 
  currentLevel: 1 | 2 | 3; 
  currentItemCount: number;
  featureName: string;
}) {
  if (currentLevel >= requiredLevel) return null;
  
  const targetItems = requiredLevel === 2 ? 15 : 30;
  const itemsNeeded = Math.max(0, targetItems - currentItemCount);
  
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200 text-center">
      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
        <Lock size={24} className="text-gray-400" />
      </div>
      <h4 className="font-semibold text-gray-700 mb-1">{featureName}</h4>
      <p className="text-sm text-gray-500">
        Log {itemsNeeded} more items to unlock
      </p>
    </div>
  );
}
