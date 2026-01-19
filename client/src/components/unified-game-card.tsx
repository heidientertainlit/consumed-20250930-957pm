import { useState } from 'react';
import { Brain, BarChart, Target, Dna, Users, Clock } from 'lucide-react';

interface GameOption {
  label: string;
  percentage: number;
  isSelected?: boolean;
}

interface UnifiedGameCardProps {
  type: 'trivia' | 'poll' | 'prediction' | 'dna';
  category: string;
  question: string;
  options: GameOption[];
  participation: number;
  timeLabel?: string;
  onSelect?: (optionIndex: number) => void;
}

const typeConfig = {
  trivia: { icon: Brain, label: 'TRIVIA', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  poll: { icon: BarChart, label: 'POLL', color: 'text-purple-600', bg: 'bg-purple-50' },
  prediction: { icon: Target, label: 'PREDICTION', color: 'text-blue-600', bg: 'bg-blue-50' },
  dna: { icon: Dna, label: 'DNA', color: 'text-pink-600', bg: 'bg-pink-50' },
};

export function UnifiedGameCard({
  type,
  category,
  question,
  options,
  participation,
  timeLabel,
  onSelect,
}: UnifiedGameCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const config = typeConfig[type];
  const Icon = config.icon;

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    onSelect?.(index);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs font-semibold ${config.color} ${config.bg} px-2 py-0.5 rounded-full`}>
            <Icon size={12} />
            {config.label}
          </span>
        </div>
        <span className="text-xs text-gray-500 font-medium">{category}</span>
      </div>

      <div className="p-4">
        <p className="text-gray-900 font-semibold text-base mb-4 leading-snug">{question}</p>

        <div className="space-y-2">
          {options.map((option, index) => {
            const isSelected = selectedIndex === index;
            return (
              <button
                key={index}
                onClick={() => handleSelect(index)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <span className={`font-medium ${isSelected ? 'text-purple-700' : 'text-gray-700'}`}>
                  {option.label}
                </span>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                  isSelected 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-white border border-gray-200 text-gray-600'
                }`}>
                  {option.percentage}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50">
        <span className="flex items-center gap-1.5 text-xs text-gray-500">
          <Users size={14} />
          {participation} played
        </span>
        {timeLabel && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Clock size={12} />
            {timeLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function UnifiedGameCardDemo() {
  return (
    <div className="space-y-4 mb-4">
      <UnifiedGameCard
        type="poll"
        category="Movies"
        question="Which finale stuck the landing better?"
        options={[
          { label: 'Breaking Bad', percentage: 67 },
          { label: 'The Sopranos', percentage: 33 },
        ]}
        participation={1247}
      />
      
      <UnifiedGameCard
        type="trivia"
        category="TV Shows"
        question="Which show won the most Emmys in a single year?"
        options={[
          { label: 'Game of Thrones', percentage: 45 },
          { label: 'Schitt\'s Creek', percentage: 32 },
          { label: 'The Marvelous Mrs. Maisel', percentage: 23 },
        ]}
        participation={892}
        timeLabel="Daily"
      />
      
      <UnifiedGameCard
        type="prediction"
        category="Awards"
        question="Will Timothée Chalamet win Best Actor at the Oscars?"
        options={[
          { label: 'Yes', percentage: 78 },
          { label: 'No', percentage: 22 },
        ]}
        participation={3421}
        timeLabel="Closes Mar 2"
      />
      
      <UnifiedGameCard
        type="dna"
        category="Your Taste"
        question="Do you prefer happy endings or bittersweet ones?"
        options={[
          { label: 'Happy endings', percentage: 54 },
          { label: 'Bittersweet', percentage: 46 },
        ]}
        participation={2156}
      />
    </div>
  );
}
