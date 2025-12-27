import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Star, Trophy, Lock, Users, ChevronDown } from "lucide-react";

interface DNALevelBadgeProps {
  level: 1 | 2 | 3;
  itemCount: number;
  showProgress?: boolean;
  compact?: boolean;
}

const LEVEL_CONFIG = {
  1: {
    name: "Snapshot",
    icon: Sparkles,
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    description: "Survey-based DNA profile",
    nextUnlock: "Celebrity Matches",
    nextLevel: 2,
    threshold: 15,
  },
  2: {
    name: "Profile",
    icon: Star,
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-100",
    textColor: "text-amber-700",
    description: "Behavior + Survey blend (60/40)",
    nextUnlock: "Friend DNA Comparisons",
    nextLevel: 3,
    threshold: 30,
  },
  3: {
    name: "Blueprint",
    icon: Trophy,
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-700",
    description: "Full behavior-driven DNA",
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
        Level {level}
      </Badge>
    );
  }

  return (
    <div className="relative">
      {/* Minimal DNA Header */}
      <div className="flex items-center gap-4 py-3">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}>
          <Icon className="text-white" size={24} />
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">Entertainment DNA</span>
            <span className="text-sm text-gray-500">Level {level}</span>
          </div>
          
          {showProgress && nextThreshold ? (
            <div className="flex items-center gap-2 mt-1">
              <Progress value={progress} className="h-1.5 flex-1 max-w-[120px]" />
              <span className="text-xs text-gray-500">{itemCount}/{nextThreshold}</span>
            </div>
          ) : level === 3 ? (
            <span className="text-xs text-emerald-600 font-medium">All features unlocked</span>
          ) : null}
        </div>

        {/* Chevron hint */}
        <div className="flex flex-col items-center text-gray-400">
          <ChevronDown size={18} className="animate-bounce" />
        </div>
      </div>

      {/* Unlock hint - subtle inline text */}
      {showProgress && nextThreshold && itemsNeeded > 0 && (
        <p className="text-xs text-gray-500 pl-16 -mt-1 mb-2">
          {level === 1 ? (
            <>Log <span className="font-semibold text-purple-600">{itemsNeeded} more</span> to unlock Celebrity Matches</>
          ) : (
            <>Log <span className="font-semibold text-amber-600">{itemsNeeded} more</span> to unlock Friend Comparisons</>
          )}
        </p>
      )}
    </div>
  );
}

export function DNALevelProgress({ itemCount }: { itemCount: number }) {
  const level = itemCount >= 30 ? 3 : itemCount >= 15 ? 2 : 1;
  
  return (
    <div className="flex items-center gap-1">
      {/* Level 1 */}
      <div className={`w-2 h-2 rounded-full ${level >= 1 ? 'bg-purple-500' : 'bg-gray-300'}`} />
      <div className={`flex-1 h-1 ${level >= 2 ? 'bg-amber-500' : 'bg-gray-200'}`} />
      
      {/* Level 2 */}
      <div className={`w-2 h-2 rounded-full ${level >= 2 ? 'bg-amber-500' : 'bg-gray-300'}`} />
      <div className={`flex-1 h-1 ${level >= 3 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
      
      {/* Level 3 */}
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
