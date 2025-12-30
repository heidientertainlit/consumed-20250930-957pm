import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Star, Trophy, Lock, ChevronDown } from "lucide-react";

interface DNALevelBadgeProps {
  level: 0 | 1 | 2;
  itemCount: number;
  showProgress?: boolean;
  compact?: boolean;
  hasSurvey?: boolean;
}

const LEVEL_CONFIG = {
  0: {
    name: "No DNA Yet",
    icon: Lock,
    color: "from-gray-400 to-gray-500",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
    description: "Complete the survey to unlock",
    nextUnlock: "DNA Summary",
    nextLevel: 1,
    threshold: 0,
    nextThreshold: 10,
  },
  1: {
    name: "DNA Summary",
    icon: Sparkles,
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
    description: "Survey + behavior profile",
    nextUnlock: "Friend DNA Comparisons",
    nextLevel: 2,
    threshold: 10,
    nextThreshold: 30,
  },
  2: {
    name: "DNA Friend Compare",
    icon: Trophy,
    color: "from-emerald-500 to-teal-500",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-700",
    description: "Compare with friends",
    nextUnlock: null,
    nextLevel: null,
    threshold: 30,
    nextThreshold: null,
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
        
        {/* Status indicator only */}
        <div className="flex items-center gap-2">
          {level === 2 ? (
            <span className="text-xs text-emerald-600 font-medium">All unlocked</span>
          ) : level === 0 ? (
            <span className="text-xs text-gray-500 font-medium">Survey required</span>
          ) : (
            <span className="text-xs text-purple-600 font-medium">{itemCount} logged</span>
          )}
          <ChevronDown size={16} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
}

export function DNALevelProgress({ itemCount, hasSurvey = false }: { itemCount: number; hasSurvey?: boolean }) {
  const level = hasSurvey && itemCount >= 30 ? 2 : hasSurvey && itemCount >= 10 ? 1 : 0;
  
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${level >= 1 ? 'bg-purple-500' : 'bg-gray-300'}`} />
      <div className={`flex-1 h-1 ${level >= 2 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
      <div className={`w-2 h-2 rounded-full ${level >= 2 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
    </div>
  );
}

export function getDnaLevel(itemCount: number, hasSurvey: boolean): 0 | 1 | 2 {
  if (!hasSurvey) return 0;
  if (itemCount >= 30) return 2;
  if (itemCount >= 10) return 1;
  return 0;
}

export function DNAFeatureLock({ requiredLevel, currentLevel, currentItemCount, featureName, hasSurvey = false }: { 
  requiredLevel: 1 | 2; 
  currentLevel: 0 | 1 | 2; 
  currentItemCount: number;
  featureName: string;
  hasSurvey?: boolean;
}) {
  if (currentLevel >= requiredLevel) return null;
  
  const targetItems = requiredLevel === 1 ? 10 : 30;
  const itemsNeeded = Math.max(0, targetItems - currentItemCount);
  
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-200 text-center">
      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mb-3">
        <Lock size={24} className="text-gray-400" />
      </div>
      <h4 className="font-semibold text-gray-700 mb-1">{featureName}</h4>
      {!hasSurvey ? (
        <p className="text-sm text-gray-500">
          Complete the DNA survey to unlock
        </p>
      ) : (
        <p className="text-sm text-gray-500">
          Log {itemsNeeded} more items to unlock
        </p>
      )}
    </div>
  );
}
