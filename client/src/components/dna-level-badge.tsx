import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Star, Trophy, Lock, Users } from "lucide-react";

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
  
  // Calculate progress to next level
  const nextThreshold = config.threshold;
  const prevThreshold = level === 1 ? 0 : level === 2 ? 15 : 30;
  const itemsNeeded = nextThreshold ? Math.max(0, nextThreshold - itemCount) : 0;
  const progress = nextThreshold 
    ? Math.min(100, ((itemCount - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      {/* Level Badge Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center shadow-md`}>
            <Icon className="text-white" size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">Level {level}</span>
              <Badge className={`${config.bgColor} ${config.textColor} text-xs`}>
                {config.name}
              </Badge>
            </div>
            <p className="text-xs text-gray-500">{config.description}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{itemCount}</div>
          <div className="text-xs text-gray-500">items logged</div>
        </div>
      </div>

      {/* Progress to Next Level */}
      {showProgress && nextThreshold && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-600">Progress to Level {config.nextLevel}</span>
            <span className="font-medium text-gray-900">{itemCount}/{nextThreshold}</span>
          </div>
          <Progress value={progress} className="h-2" />
          
          {/* Unlock Message */}
          <div className="flex items-center gap-2 mt-3 p-2 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-100">
            {level === 1 ? (
              <Star size={16} className="text-amber-500 flex-shrink-0" />
            ) : (
              <Users size={16} className="text-emerald-500 flex-shrink-0" />
            )}
            <span className="text-xs text-gray-700">
              <span className="font-semibold text-purple-700">Log {itemsNeeded} more items</span> to unlock {config.nextUnlock}
            </span>
          </div>
        </div>
      )}

      {/* Max Level */}
      {level === 3 && (
        <div className="flex items-center gap-2 mt-2 p-2 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg border border-emerald-100">
          <Trophy size={16} className="text-emerald-600 flex-shrink-0" />
          <span className="text-xs text-gray-700">
            <span className="font-semibold text-emerald-700">Max level reached!</span> All DNA features unlocked.
          </span>
        </div>
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

export function DNAFeatureLock({ requiredLevel, currentLevel, featureName }: { requiredLevel: 2 | 3; currentLevel: 1 | 2 | 3; featureName: string }) {
  if (currentLevel >= requiredLevel) return null;
  
  const itemsNeeded = requiredLevel === 2 ? 15 : 30;
  
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200 text-center">
      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
        <Lock size={24} className="text-gray-400" />
      </div>
      <h4 className="font-semibold text-gray-700 mb-1">{featureName} Locked</h4>
      <p className="text-sm text-gray-500 mb-3">
        Log {itemsNeeded - (currentLevel === 1 ? 0 : 15)} more items to unlock
      </p>
      <Badge className="bg-purple-100 text-purple-700 text-xs">
        Requires Level {requiredLevel}
      </Badge>
    </div>
  );
}
