'use client';

import { useEffect, useState } from 'react';
import { Clock, Zap } from 'lucide-react';

interface UsageData {
  minutesUsed: number;
  minutesPurchased: number;
  remainingMinutes: number;
  hasUnlimitedAccess: boolean;
  formattedRemaining: string;
  subscriptionStatus: string;
}

export default function UsageCounter() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/user/usage');
      if (response.ok) {
        const data = await response.json();
        setUsage(data.usage);
      }
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-base-200 rounded-lg">
        <div className="loading loading-spinner loading-xs"></div>
        <span className="text-xs">Ładowanie...</span>
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const percentageUsed = Math.round((usage.minutesUsed / usage.minutesPurchased) * 100);
  const isLowOnTime = usage.remainingMinutes < 30; // Less than 30 minutes left
  const isOutOfTime = usage.remainingMinutes === 0;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
      isOutOfTime 
        ? 'bg-error/10 text-error border border-error/20' 
        : isLowOnTime 
          ? 'bg-warning/10 text-warning border border-warning/20'
          : 'bg-base-200'
    }`}>
      <div className="flex items-center gap-1">
        {usage.subscriptionStatus === 'FREE' ? (
          <Clock className="w-4 h-4" />
        ) : (
          <Zap className="w-4 h-4" />
        )}
        
        <span className="text-sm font-medium">
          {usage.formattedRemaining}
        </span>
      </div>

      {/* Progress indicator */}
      <div className="hidden sm:flex items-center gap-2">
        <div className="w-16 h-1 bg-base-300 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              isOutOfTime 
                ? 'bg-error' 
                : isLowOnTime 
                  ? 'bg-warning' 
                  : 'bg-primary'
            }`}
            style={{ width: `${Math.min(percentageUsed, 100)}%` }}
          />
        </div>
        
        <span className="text-xs text-base-content/60">
          {usage.subscriptionStatus === 'FREE' ? 'Free' : 'Paid'}
        </span>
      </div>

      {/* Warning tooltip for low time */}
      {isLowOnTime && (
        <div className="tooltip tooltip-bottom" data-tip={
          isOutOfTime 
            ? "Wykup pakiet 5h za 25 zł aby kontynuować" 
            : "Zostało mało czasu - rozważ dokupienie pakietu"
        }>
          <div className={`w-2 h-2 rounded-full animate-pulse ${
            isOutOfTime ? 'bg-error' : 'bg-warning'
          }`} />
        </div>
      )}
    </div>
  );
}