export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface PoolWithStats {
  id: string;
  title: string;
  description: string;
  category: string;
  totalPot: string;
  participantCount: number;
  endDate: string;
  predictionStats?: {
    [key: string]: {
      percentage: number;
      count: number;
    };
  };
}

export interface PredictionOption {
  value: string;
  label: string;
  percentage?: number;
  count?: number;
}
