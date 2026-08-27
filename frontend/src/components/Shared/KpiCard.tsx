import { useId } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowTrendDown, faArrowTrendUp } from '@fortawesome/free-solid-svg-icons';
import { cn } from '@/lib/utils';

const COLOR_CONFIG = {
  blue:   { bar: 'from-sky-400 to-indigo-500',    iconBg: 'bg-sky-50 dark:bg-sky-500/10',     spark: '#0ea5e9' },
  green:  { bar: 'from-emerald-400 to-green-600', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', spark: '#10b981' },
  amber:  { bar: 'from-amber-400 to-red-400',     iconBg: 'bg-amber-50 dark:bg-amber-500/10',   spark: '#f59e0b' },
  purple: { bar: 'from-violet-400 to-indigo-500', iconBg: 'bg-violet-50 dark:bg-violet-500/10',  spark: '#8b5cf6' },
  pink:   { bar: 'from-pink-400 to-rose-500',     iconBg: 'bg-pink-50 dark:bg-pink-500/10',    spark: '#ec4899' },
} as const;

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendDir?: 'up' | 'down' | 'neutral';
  color: keyof typeof COLOR_CONFIG;
  icon: IconDefinition;
  sparklineData?: number[];
  isLoading?: boolean;
}

export function KpiCard({
  title, value, subtitle, trend, trendDir = 'neutral',
  color, icon, sparklineData, isLoading,
}: KpiCardProps) {
  const uid = useId();
  const cfg = COLOR_CONFIG[color];
  const sparkData = (sparklineData ?? []).map((v, i) => ({ i, v }));

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[var(--card-shadow)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className={cn('absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r', cfg.bar)} />
      <div className="p-4 pt-5">
        <div className="flex items-start justify-between mb-2">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-[14px] text-[15px]', cfg.iconBg)}>
            <FontAwesomeIcon icon={icon} />
          </div>
          {trend && (
            <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full', {
              'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300': trendDir === 'up',
              'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300':         trendDir === 'down',
              'bg-muted text-muted-foreground':    trendDir === 'neutral',
            })}>
              {trendDir !== 'neutral' && <FontAwesomeIcon icon={trendDir === 'up' ? faArrowTrendUp : faArrowTrendDown} className="me-1" />}{trend}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="h-7 bg-muted rounded animate-pulse my-1" />
        ) : (
          <p className="text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">{title}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="h-10 px-1 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`kpi-spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.spark} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={cfg.spark} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v"
                stroke={cfg.spark} strokeWidth={1.5}
                fill={`url(#kpi-spark-${uid})`}
                dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
