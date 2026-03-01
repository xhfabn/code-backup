'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getDifficultyColor } from '@/hooks';
import { Calendar, Eye, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ReviewTask, CardSessionState } from '@/types/review';

interface ReviewMainCardProps {
  task: ReviewTask;
  cardState: CardSessionState;
  /** true = came from 忘记; answer is auto-shown in relearn preview mode */
  isRelearn: boolean;
  isSubmitting: boolean;
  onRate: (score: 0 | 2 | 4) => void;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  Easy: '简单', easy: '简单', 简单: '简单',
  Medium: '中等', medium: '中等', 中等: '中等',
  Hard: '困难', hard: '困难', 困难: '困难',
};

const RateButton = ({
  score,
  label,
  description,
  colorClass,
  onClick,
  disabled,
  dimmed,
}: {
  score: number;
  label: string;
  description: string;
  colorClass: string;
  onClick: () => void;
  disabled: boolean;
  dimmed: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={description}
    className={cn(
      'flex flex-col items-center justify-center gap-1.5 py-4 rounded-2xl border-2 transition-all duration-200 active:scale-95 disabled:cursor-not-allowed',
      dimmed
        ? 'opacity-30 pointer-events-none border-gray-100 bg-gray-50 text-gray-400'
        : colorClass,
    )}
  >
    <span className="text-base font-bold">{label}</span>
    <span className="text-[10px] opacity-70 px-2 text-center leading-tight">{description}</span>
  </button>
);

export const ReviewMainCard = ({
  task,
  cardState,
  isRelearn,
  isSubmitting,
  onRate,
}: ReviewMainCardProps) => {
  const [phase, setPhase] = useState<'preview' | 'question' | 'answer'>(
    isRelearn ? 'preview' : 'question',
  );

  // Reset phase when a new card (re-insertion of same card) arrives
  useEffect(() => {
    setPhase(isRelearn ? 'preview' : 'question');
  }, [task.id, isRelearn, cardState.sessionFailCount]);

  const diffLabel = DIFFICULTY_LABELS[task.difficulty] ?? task.difficulty;
  const failCount = cardState.sessionFailCount;
  const isFirstAppearance = !cardState.hasBeenShown || (isRelearn === false && failCount === 0);

  const keywords = task.answerKeywords
    ?.split(/[,，]+/)
    .map((k) => k.trim())
    .filter(Boolean) ?? [];

  return (
    <motion.div
      key={`${task.id}-${failCount}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full max-w-2xl mx-auto"
    >
      <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-gray-200/70 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.1)] overflow-hidden">
        {/* ── Card Header ─────────────────────────────────── */}
        <div className="p-8 pb-6 space-y-4">
          {/* Meta row */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-gray-400 font-bold text-sm tracking-wide bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
              #{task.questionId}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'font-bold border px-3 py-0.5 rounded-lg text-xs',
                getDifficultyColor(task.difficulty),
              )}
            >
              {diffLabel}
            </Badge>

            {/* Relearn badge */}
            {isRelearn && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                <RotateCcw size={11} />
                重学
              </span>
            )}
            {!isRelearn && failCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-lg">
                <RotateCcw size={11} />
                再次复习
              </span>
            )}

            {task.lastReviewDate && (
              <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5 ml-auto">
                <Calendar size={11} />
                {task.lastReviewDate}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 leading-snug">
            {task.title}
          </h2>

          {/* Fail indicator dots */}
          {failCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">本轮</span>
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-colors',
                    i < failCount ? 'bg-rose-400' : 'bg-gray-200',
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Phase: Preview (relearn auto-show answer) ─── */}
        <AnimatePresence mode="wait">
          {phase === 'preview' && (
            <motion.div
              key="preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-8 pb-8 space-y-4"
            >
              <div className="p-5 border-2 border-amber-100 rounded-2xl bg-amber-50/40 space-y-3">
                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm">
                  <Eye size={15} />
                  先看一遍答案，再开始复测
                </div>
                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm max-h-52 overflow-y-auto">
                  {task.answer || '暂无答案'}
                </div>
                {keywords.length > 0 && (
                  <div className="flex gap-2 flex-wrap pt-1">
                    {keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-3 py-1 text-amber-700 font-bold text-xs bg-amber-100 rounded-full border border-amber-300 whitespace-nowrap"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button
                className="w-full h-12 rounded-xl font-bold text-sm bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => setPhase('question')}
              >
                <CheckCircle2 size={16} className="mr-2" />
                记住了，开始复测
              </Button>
            </motion.div>
          )}

          {/* ── Phase: Question (show title, answer hidden) ─── */}
          {phase === 'question' && (
            <motion.div
              key="question"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-8 pb-8 space-y-4"
            >
              {/* Hidden answer hint */}
              <button
                className="w-full py-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 hover:border-blue-300 hover:bg-blue-50/30 transition-all group"
                onClick={() => setPhase('answer')}
              >
                <div className="flex flex-col items-center gap-2">
                  <Eye size={24} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                  <span className="text-sm font-medium text-gray-400 group-hover:text-blue-500 transition-colors">
                    点击查看答案
                  </span>
                </div>
              </button>

              {/* Rate buttons (dimmed until answer revealed) */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">
                  查看答案后评分
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <RateButton score={0} label="不记得" description="需要重新学习" colorClass="bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-500 hover:text-white hover:shadow-lg hover:shadow-rose-100" onClick={() => onRate(0)} disabled={isSubmitting} dimmed />
                  <RateButton score={2} label="模糊" description="有印象但不清晰" colorClass="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-500 hover:text-white hover:shadow-lg hover:shadow-amber-100" onClick={() => onRate(2)} disabled={isSubmitting} dimmed />
                  <RateButton score={4} label="记得" description="掌握清晰" colorClass="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-100" onClick={() => onRate(4)} disabled={isSubmitting} dimmed />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Phase: Answer ─────────────────────────────── */}
          {phase === 'answer' && (
            <motion.div
              key="answer"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-8 pb-8 space-y-4"
            >
              {/* Answer content */}
              <div className="p-5 border-2 border-emerald-100 rounded-2xl bg-gradient-to-br from-emerald-50/40 to-white space-y-3">
                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">答案</div>
                <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm max-h-64 overflow-y-auto">
                  {task.answer || '暂无答案'}
                </div>
                {keywords.length > 0 && (
                  <>
                    <div className="border-t border-emerald-100" />
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">核心关键词</div>
                      <div className="flex gap-2 flex-wrap">
                        {keywords.map((kw, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-3 py-1.5 text-red-600 font-bold text-xs bg-red-50 rounded-full border-2 border-red-300 whitespace-nowrap"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Rate buttons (active) */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                  评估掌握程度
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <RateButton score={0} label="不记得" description="需要重新学习" colorClass="bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-500 hover:text-white hover:shadow-lg hover:shadow-rose-100" onClick={() => onRate(0)} disabled={isSubmitting} dimmed={false} />
                  <RateButton score={2} label="模糊" description="有印象但不清晰" colorClass="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-500 hover:text-white hover:shadow-lg hover:shadow-amber-100" onClick={() => onRate(2)} disabled={isSubmitting} dimmed={false} />
                  <RateButton score={4} label="记得" description="掌握清晰" colorClass="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-100" onClick={() => onRate(4)} disabled={isSubmitting} dimmed={false} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
