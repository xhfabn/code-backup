import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';
import { getDifficultyColor } from '@/hooks';

import { Calendar, ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { ReviewTask } from '@/types/review';
import { MASTERY_COLORS } from '@/constants';
import { itemVariants } from '@/animations/reviewAnimations';

interface ReviewCardProps {
  task: ReviewTask;
  isActive: boolean;
  isSubmitting: boolean;
  onActivate: () => void;
  onCancel: () => void;
  onRate: (score: number) => void;
  onPreview: () => void;
}

const RateButton = ({
  label,
  colorClass,
  onClick,
  disabled,
  description,
}: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={description}
    className={cn(
      'flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group',
      colorClass,
    )}
  >
    <span className="text-lg font-bold tracking-wide">{label}</span>
    <span className="text-[10px] opacity-70 group-hover:opacity-100 px-2 text-center">
      {description}
    </span>
  </button>
);

export const ReviewCard = ({
  task,
  isActive,
  isSubmitting,
  onActivate,
  onCancel,
  onRate,
  onPreview,
}: ReviewCardProps) => {
  const { t } = useTranslation();
  const [showAnswer, setShowAnswer] = useState(false);

  const handleCardClick = () => {
    if (!isActive) {
      onActivate();
    } else if (!showAnswer) {
      setShowAnswer(true);
    }
  };

  const handleRate = (score: number) => {
    onRate(score);
    setShowAnswer(false);
  };

  return (
    <motion.div
      layout
      variants={itemVariants}
      className={cn(
        'group relative bg-white/60 backdrop-blur-xl rounded-[2rem] p-8 transition-all duration-300 border',
        isActive
          ? 'bg-white border-[#3b82f6]/50 ring-4 ring-[#3b82f6]/10 shadow-[0_20px_40px_-12px_rgba(255,161,22,0.2)] z-10 scale-[1.02]'
          : 'border-white/60 hover:border-[#3b82f6]/30 hover:bg-white/80 hover:shadow-lg hover:shadow-gray-200/50 cursor-pointer',
      )}
      onClick={!isActive || !showAnswer ? handleCardClick : undefined}
    >
      <div className="flex flex-col gap-6">
        {/* Header Info */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-gray-400 font-bold text-lg tracking-wide bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100">
              #{task.questionId}
            </span>
            <Badge
              variant="outline"
              className={cn(
                'font-bold border px-3 py-1 rounded-lg shadow-sm text-xs',
                getDifficultyColor(task.difficulty),
              )}
            >
              {t(`questionsTable.diff${task.difficulty}` as any)}
            </Badge>
            {task.lastReviewDate && (
              <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5 ml-auto bg-white/50 px-2 py-1 rounded-md">
                <Calendar size={12} />
                <span className="hidden sm:inline">
                  {t('reviewCard.lastReview')}:
                </span>
                {task.lastReviewDate}
              </span>
            )}
          </div>

          {/* Question Title */}
          <h3
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="text-2xl font-bold text-gray-900 leading-snug group-hover:text-[#3b82f6] transition-colors duration-300 cursor-pointer"
          >
            {task.title}
          </h3>

          {/* Mastery Level */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {t('reviewCard.currentMastery')}
            </span>
            <div className="h-2.5 flex-1 max-w-[120px] rounded-full bg-gray-100 overflow-hidden inner-shadow">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                style={{
                  width: `${(task.masteryLevel / 5) * 100}%`,
                  backgroundColor: MASTERY_COLORS[task.masteryLevel] || '#ccc',
                }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-gray-500">
              Lv.{task.masteryLevel}
            </span>
          </div>
        </div>

        {/* Answer Section (shown when active) */}
        {isActive && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {!showAnswer ? (
              <div className="flex items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <div className="text-center space-y-3">
                  <ChevronDown
                    size={32}
                    className="mx-auto text-gray-400 animate-bounce"
                  />
                  <p className="text-gray-500 font-medium">
                    点击查看答案
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Answer Content */}
                <div className="p-6 border-2 border-emerald-100 rounded-2xl bg-gradient-to-br from-emerald-50/50 to-white">
                  <div className="flex items-center gap-2 mb-3">
                    <ChevronUp size={20} className="text-emerald-600" />
                    <h4 className="font-bold text-emerald-900">答案</h4>
                  </div>
                  <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {task.answer || '暂无答案'}
                  </div>

                  {/* 关键词展示 */}
                  {task.answerKeywords && task.answerKeywords.trim() && (
                    <>
                      {/* 分隔线 */}
                      <div className="my-4 border-t border-emerald-200" />

                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                          核心关键词
                        </div>

                        {/* 单行横向滚动展示，每个关键词一个气泡 */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {task.answerKeywords.split(/[,，]+/).filter(k => k.trim()).map((keyword, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-4 py-2 text-red-600 font-bold text-sm bg-red-50 rounded-full border-2 border-red-400 shadow-md whitespace-nowrap flex-shrink-0"
                            >
                              {keyword.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Rating Buttons */}
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-900">
                      评估掌握程度
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-red-500 h-8 px-2 rounded-lg -mr-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAnswer(false);
                        onCancel();
                      }}
                      disabled={isSubmitting}
                    >
                      {t('reviewCard.cancelBtn')}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 不记得 (rating=0) */}
                    <RateButton
                      label="不记得"
                      description="完全不会，需要重新学习"
                      colorClass="bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-500 hover:text-white hover:shadow-lg hover:shadow-rose-200"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        handleRate(0);
                      }}
                      disabled={isSubmitting}
                    />

                    {/* 模糊 (rating=2) */}
                    <RateButton
                      label="模糊"
                      description="有印象但不够清晰"
                      colorClass="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-500 hover:text-white hover:shadow-lg hover:shadow-amber-200"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        handleRate(2);
                      }}
                      disabled={isSubmitting}
                    />

                    {/* 记得 (rating=4) */}
                    <RateButton
                      label="记得"
                      description="掌握清晰，回答准确"
                      colorClass="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-500 hover:text-white hover:shadow-lg hover:shadow-emerald-200"
                      onClick={(e: any) => {
                        e.stopPropagation();
                        handleRate(4);
                      }}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inactive State Hint */}
        {!isActive && (
          <div className="text-center py-2">
            <p className="text-sm text-gray-400 font-medium">
              点击卡片开始复习
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
