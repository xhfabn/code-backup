'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getDifficultyColor } from '@/hooks';
import { ReviewTask, CardSessionState } from '@/types/review';
import { CheckCircle2, XCircle, RotateCcw, ArrowRight, Circle } from 'lucide-react';

interface SidebarItem {
  taskId: string;
  /** true if this is a re-insertion slot (same card appearing again) */
  isReinserted: boolean;
}

interface ReviewTaskSidebarProps {
  /** All unique tasks */
  taskMap: Map<string, ReviewTask>;
  /** Sidebar display order: original tasks only (deduplicated by taskId) */
  originalOrder: string[];
  /** Current session state per task */
  cardStates: Map<string, CardSessionState>;
  /** taskId of the card currently on screen */
  currentTaskId: string | null;
  /** Total cards in the original list */
  total: number;
  /** How many are done (mastered + failed) */
  completed: number;
}

const STATUS_ICONS = {
  mastered: <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />,
  failed:   <XCircle     size={14} className="text-rose-400   shrink-0" />,
  relearning:<RotateCcw  size={14} className="text-amber-500  shrink-0" />,
  current:  <ArrowRight  size={14} className="text-blue-500   shrink-0" />,
  pending:  <Circle      size={14} className="text-gray-300   shrink-0" />,
} as const;

const STATUS_TEXT: Record<string, string> = {
  mastered:   '已掌握',
  failed:     '未掌握',
  relearning: '重学中',
  current:    '当前',
  pending:    '待复习',
};

export const ReviewTaskSidebar = ({
  taskMap,
  originalOrder,
  cardStates,
  currentTaskId,
  total,
  completed,
}: ReviewTaskSidebarProps) => {
  const currentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll so the current item stays visible
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentTaskId]);

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 shrink-0">
      <div className="sticky top-8 bg-white/70 backdrop-blur-xl rounded-[1.5rem] border border-gray-200/60 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <span className="text-sm font-bold text-gray-700">今日任务</span>
          <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
            {completed} / {total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100 shrink-0">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Task list */}
        <div className="overflow-y-auto flex-1 py-2">
          {originalOrder.map((taskId) => {
            const task = taskMap.get(taskId);
            if (!task) return null;

            const state = cardStates.get(taskId);
            const isCurrent = taskId === currentTaskId;

            let displayStatus: keyof typeof STATUS_ICONS = 'pending';
            if (isCurrent) {
              displayStatus = state?.sessionStatus === 'relearning' ? 'relearning' : 'current';
            } else if (state?.sessionStatus === 'mastered') {
              displayStatus = 'mastered';
            } else if (state?.sessionStatus === 'failed') {
              displayStatus = 'failed';
            } else if (state?.sessionStatus === 'relearning') {
              displayStatus = 'relearning';
            }

            return (
              <div
                key={taskId}
                ref={isCurrent ? currentRef : undefined}
                className={cn(
                  'px-4 py-3 flex items-start gap-3 transition-colors border-b border-gray-50 last:border-0',
                  isCurrent && 'bg-blue-50/60',
                  (displayStatus === 'mastered' || displayStatus === 'failed') && 'opacity-50',
                )}
              >
                <div className="mt-0.5">{STATUS_ICONS[displayStatus]}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <p
                    className={cn(
                      'text-xs font-medium leading-snug truncate',
                      isCurrent ? 'text-gray-900' : 'text-gray-600',
                    )}
                  >
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                        getDifficultyColor(task.difficulty),
                      )}
                    >
                      {task.difficulty}
                    </span>
                    {state && state.sessionFailCount > 0 && (
                      <span className="text-[10px] text-rose-400 font-bold">
                        ×{state.sessionFailCount}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {STATUS_TEXT[displayStatus]}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
