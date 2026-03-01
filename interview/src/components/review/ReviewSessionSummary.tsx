'use client';

import { motion } from 'framer-motion';
import { SessionStats } from '@/types/review';
import { CheckCircle2, XCircle, RotateCcw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface ReviewSessionSummaryProps {
  stats: SessionStats;
}

export const ReviewSessionSummary = ({ stats }: ReviewSessionSummaryProps) => {
  const total = stats.direct + stats.relearned + stats.failed;
  const mastered = stats.direct + stats.relearned;
  const pct = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="w-full max-w-lg mx-auto"
    >
      <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] border border-gray-200/70 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)] p-10 space-y-8 text-center">
        {/* Emoji + headline */}
        <div className="space-y-3">
          <div className="text-5xl">{pct >= 80 ? '🎉' : pct >= 50 ? '💪' : '📖'}</div>
          <h2 className="text-2xl font-extrabold text-gray-900">本轮复习完成</h2>
          <p className="text-gray-500 text-sm">
            共复习 <span className="font-bold text-gray-700">{total}</span> 张卡片
          </p>
        </div>

        {/* Big percentage */}
        <div className="space-y-2">
          <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-emerald-500">
            {pct}%
          </div>
          <p className="text-sm text-gray-400 font-medium">掌握率</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 to-emerald-400"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>

        {/* Stats breakdown */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<CheckCircle2 size={18} className="text-emerald-500" />}
            value={stats.direct}
            label="直接掌握"
            bg="bg-emerald-50"
          />
          <StatCard
            icon={<RotateCcw size={18} className="text-amber-500" />}
            value={stats.relearned}
            label="重学后掌握"
            bg="bg-amber-50"
          />
          <StatCard
            icon={<XCircle size={18} className="text-rose-400" />}
            value={stats.failed}
            label="未掌握"
            bg="bg-rose-50"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="flex-1 h-11 rounded-xl font-bold bg-blue-500 hover:bg-blue-600 text-white">
            <Link href="/home">
              <ArrowRight size={16} className="mr-2" />
              返回首页
            </Link>
          </Button>
          <Button asChild variant="outline" className="flex-1 h-11 rounded-xl font-bold border-gray-200">
            <Link href="/questions">查看题库</Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

const StatCard = ({
  icon,
  value,
  label,
  bg,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  bg: string;
}) => (
  <div className={`${bg} rounded-2xl p-4 space-y-2`}>
    <div className="flex justify-center">{icon}</div>
    <div className="text-2xl font-black text-gray-800">{value}</div>
    <div className="text-[10px] font-semibold text-gray-500 leading-tight">{label}</div>
  </div>
);
