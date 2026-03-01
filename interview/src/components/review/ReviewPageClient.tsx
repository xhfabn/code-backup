'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { submitReviewWithPath } from '@/actions/review';
import {
  ReviewTask,
  ReviewClientProps,
  QueueItem,
  CardSessionState,
  SessionStats,
  SessionPath,
} from '@/types/review';
import { loadSession, saveSession, clearSession } from '@/lib/reviewSessionStorage';

import { ReviewMainCard } from './ReviewMainCard';
import { ReviewTaskSidebar } from './ReviewTaskSidebar';
import { ReviewSessionSummary } from './ReviewSessionSummary';
import { ReviewHeader } from './ReviewHeader';

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_FAIL_COUNT = 3;

/**
 * How many cards to skip before re-inserting a card.
 *
 * Uses the remaining queue length to produce a proportional gap:
 *   模糊(2): vagueGap  = clamp(round(remaining * 0.25), 6, 12)
 *   忘记(0): forgetGap = clamp(round(remaining * 0.12), 3, 6)
 *
 * @param score     0 = 忘记, 2 = 模糊
 * @param remaining number of cards still ahead in the queue (queue.length - currentIndex - 1)
 */
function insertOffset(score: 0 | 2, remaining: number): number {
  const clamp = (val: number, min: number, max: number) =>
    Math.min(Math.max(val, min), max);

  if (score === 2) {
    return clamp(Math.round(remaining * 0.25), 6, 12);
  }
  // score === 0 (忘记)
  return clamp(Math.round(remaining * 0.12), 3, 6);
}

function resolveSessionPath(state: CardSessionState): SessionPath {
  if (state.hadForgetFailure) return 'forget-mastered';
  if (state.sessionFailCount > 0) return 'vague-mastered';
  return 'direct';
}

// ─── Initial state builders ───────────────────────────────────────────────────
function buildInitialQueue(reviews: ReviewTask[]): QueueItem[] {
  return reviews.map((t) => ({ queueId: `${t.id}-init`, taskId: t.id, isRelearn: false }));
}

function buildInitialCardStates(reviews: ReviewTask[]): Map<string, CardSessionState> {
  const m = new Map<string, CardSessionState>();
  reviews.forEach((t) =>
    m.set(t.id, {
      taskId: t.id,
      sessionFailCount: 0,
      hasBeenShown: false,
      hadForgetFailure: false,
      sessionStatus: 'pending',
      sessionPath: 'direct',
    }),
  );
  return m;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ReviewPageClient({ initialReviews }: ReviewClientProps) {
  const taskMap = useMemo<Map<string, ReviewTask>>(() => {
    const m = new Map<string, ReviewTask>();
    initialReviews.forEach((t) => m.set(t.id, t));
    return m;
  }, [initialReviews]);

  const originalOrder = useMemo(() => initialReviews.map((t) => t.id), [initialReviews]);

  // ── Restore from localStorage (runs once at mount) ────────────────────────
  // Computing inside the first useState lazy-initializer ensures it runs
  // exactly once and the result is shared by all subsequent initializers.
  const [initialData] = useState(() => {
    const saved = loadSession(originalOrder);
    return {
      queue:            saved?.queue        ?? buildInitialQueue(initialReviews),
      currentIndex:     saved?.currentIndex ?? 0,
      cardStates:       saved?.cardStates   ?? buildInitialCardStates(initialReviews),
      sessionStats:     saved?.sessionStats ?? { direct: 0, relearned: 0, failed: 0 },
      restored:         !!saved,
      /** Fixed total for the whole session — never shrinks as cards are reviewed */
      sessionTotal:     saved?.originalTotal ?? initialReviews.length,
      /**
       * The canonical task-ID list for this session — must be preserved across
       * all saveSession calls so the "pending subset" validation never breaks
       * when the server returns fewer cards after a card is mastered.
       */
      sessionTaskIds:   saved?.sessionTaskIds ?? originalOrder,
    };
  });

  // ── Core mutable state ────────────────────────────────────────────────────
  const [queue, setQueue]             = useState<QueueItem[]>(initialData.queue);
  const [currentIndex, setCurrentIndex] = useState(initialData.currentIndex);
  const [cardStates, setCardStates]   = useState<Map<string, CardSessionState>>(initialData.cardStates);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionStats, setSessionStats] = useState<SessionStats>(initialData.sessionStats);

  // ── Notify user when a previous session is resumed ───────────────────────
  useEffect(() => {
    if (initialData.restored) {
      toast.info('已恢复上次未完成的复习进度');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived current card ──────────────────────────────────────────────────
  const currentItem = queue[currentIndex] ?? null;
  const currentTask = currentItem ? (taskMap.get(currentItem.taskId) ?? null) : null;
  const currentCardState = currentItem ? (cardStates.get(currentItem.taskId) ?? null) : null;

  // Count all terminal cards across the STABLE session task list.
  // We use sessionTaskIds (never shrinks) instead of originalOrder (shrinks as
  // mastered cards are written to DB and removed from the server's due list).
  // The cardStates map always has entries for every session card, so mastered
  // cards are counted correctly even after they leave the server's due list.
  const totalCompleted = useMemo(
    () =>
      initialData.sessionTaskIds.filter((id) => {
        const s = cardStates.get(id);
        return s?.sessionStatus === 'mastered' || s?.sessionStatus === 'failed';
      }).length,
    [cardStates], // initialData is stable (useState), no need in deps
  );

  // ── Mark current card as shown when it changes ───────────────────────────
  useEffect(() => {
    if (!currentItem) return;
    const { taskId } = currentItem;
    setCardStates((prev) => {
      const s = prev.get(taskId);
      // Never overwrite a terminal state (mastered / failed)
      if (!s || s.sessionStatus === 'mastered' || s.sessionStatus === 'failed') return prev;
      const next = new Map(prev);
      next.set(taskId, { ...s, hasBeenShown: true, sessionStatus: 'current' });
      return next;
    });
  }, [currentItem?.queueId]); // re-run whenever a new queue slot becomes current

  // ── Persist session state after every state change ───────────────────────
  useEffect(() => {
    if (sessionDone) {
      clearSession();
      return;
    }
    saveSession({
      taskIds: initialData.sessionTaskIds,
      queue,
      currentIndex,
      cardStates,
      sessionStats,
    });
  }, [queue, currentIndex, cardStates, sessionStats, sessionDone]);

  // ── Rating handler ────────────────────────────────────────────────────────
  const handleRate = useCallback(
    async (score: 0 | 2 | 4) => {
      if (!currentItem || !currentTask) return;
      const { taskId } = currentItem;
      const prevState = cardStates.get(taskId)!;

      if (score === 4) {
        // ── Mastered ────────────────────────────────────────────────────────
        const finalPath = resolveSessionPath(prevState);
        const nextIdx   = currentIndex + 1;
        const isDone    = nextIdx >= queue.length;

        // Compute new state values explicitly so we can save synchronously
        const newCardStates = new Map(cardStates);
        newCardStates.set(taskId, { ...prevState, sessionStatus: 'mastered', sessionPath: finalPath });

        const newSessionStats: SessionStats = {
          ...sessionStats,
          direct:    finalPath === 'direct' ? sessionStats.direct + 1 : sessionStats.direct,
          relearned: finalPath !== 'direct' && finalPath !== 'failed'
            ? sessionStats.relearned + 1 : sessionStats.relearned,
        };

        // ── Save synchronously BEFORE React re-renders ───────────────────
        // This ensures localStorage is up-to-date even if the user navigates away
        // immediately after rating (before useEffect would have fired).
        if (!isDone) {
          saveSession({
            taskIds:      initialData.sessionTaskIds,
            queue,
            currentIndex: nextIdx,
            cardStates:   newCardStates,
            sessionStats: newSessionStats,
          });
        } else {
          clearSession();
        }

        // Update React state
        setCardStates(newCardStates);
        setSessionStats(newSessionStats);
        setCurrentIndex(nextIdx);
        if (isDone) setSessionDone(true);

        // Submit SRS in background
        console.log(`[SRS] card=${taskId} path=${finalPath} failCount=${prevState.sessionFailCount}`);
        setIsSubmitting(true);
        try {
          const result = await submitReviewWithPath(taskId, finalPath);
          if (result.success) {
            const days = result.interval!;
            toast.success(days >= 365 ? '🎉 毕业！下次在一年后' : `已记住！${days} 天后复习`);
          } else {
            toast.error('提交失败，请刷新重试');
          }
        } finally {
          setIsSubmitting(false);
        }
      } else {
        // ── Not mastered → decide re-insert or fail out ──────────────────
        const newFailCount = prevState.sessionFailCount + 1;
        const hadForget    = prevState.hadForgetFailure || score === 0;

        if (newFailCount >= MAX_FAIL_COUNT) {
          // Hit limit → mark failed
          const nextIdx = currentIndex + 1;
          const isDone  = nextIdx >= queue.length;

          const newCardStates = new Map(cardStates);
          newCardStates.set(taskId, {
            ...prevState,
            sessionFailCount: newFailCount,
            hadForgetFailure: hadForget,
            sessionStatus: 'failed',
            sessionPath:  'failed',
          });
          const newSessionStats: SessionStats = { ...sessionStats, failed: sessionStats.failed + 1 };

          // Save synchronously
          if (!isDone) {
            saveSession({
              taskIds:      initialData.sessionTaskIds,
              queue,
              currentIndex: nextIdx,
              cardStates:   newCardStates,
              sessionStats: newSessionStats,
            });
          } else {
            clearSession();
          }

          setCardStates(newCardStates);
          setSessionStats(newSessionStats);
          setCurrentIndex(nextIdx);
          if (isDone) setSessionDone(true);

          console.log(`[SRS] card=${taskId} path=failed failCount=${newFailCount}`);
          setIsSubmitting(true);
          try {
            await submitReviewWithPath(taskId, 'failed');
            toast.error(`「${currentTask.title.slice(0, 18)}…」达重复上限，已重排`);
          } finally {
            setIsSubmitting(false);
          }
        } else {
          // Re-insert at calculated offset
          const remaining = queue.length - currentIndex - 1;
          const offset    = insertOffset(score as 0 | 2, remaining);
          const reinserted: QueueItem = {
            queueId:   `${taskId}-fail${newFailCount}`,
            taskId,
            isRelearn: score === 0,
          };

          console.log(`[SRS] card=${taskId} reinserted at +${offset} (score=${score}, fail#${newFailCount}, remaining=${remaining})`);

          const newQueue  = [...queue];
          const insertAt  = Math.min(currentIndex + 1 + offset, newQueue.length);
          newQueue.splice(insertAt, 0, reinserted);

          const newCardStates = new Map(cardStates);
          newCardStates.set(taskId, {
            ...prevState,
            sessionFailCount: newFailCount,
            hadForgetFailure: hadForget,
            sessionStatus:    'relearning',
          });

          // Save synchronously
          saveSession({
            taskIds:      initialData.sessionTaskIds,
            queue:        newQueue,
            currentIndex: currentIndex + 1,
            cardStates:   newCardStates,
            sessionStats,
          });

          setQueue(newQueue);
          setCardStates(newCardStates);

          const nextIdx = currentIndex + 1;
          setCurrentIndex(nextIdx);
          // newQueue has grown so this can't trigger session done here
        }
      }
    },
    [currentItem, currentTask, cardStates, queue, currentIndex],
  );

  // ── Empty initial state ───────────────────────────────────────────────────
  if (initialReviews.length === 0) {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center">
        <DotBg />
        <div className="text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-bold text-gray-800">今日无需复习</h2>
          <p className="text-gray-500">所有卡片都在计划内，明天再来！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full">
      <DotBg />
      <div className="relative z-10 max-w-6xl mx-auto p-4 md:p-8 space-y-6 pb-24">
        <ReviewHeader total={initialData.sessionTotal} completed={totalCompleted} />

        {/* Mobile progress strip */}
        <div className="lg:hidden h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-400 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${(totalCompleted / initialData.sessionTotal) * 100}%` }}
          />
        </div>

        <div className="flex gap-8 items-start">
          {/* Main */}
          <div className="flex-1 flex flex-col items-center pt-4">
            <AnimatePresence mode="wait">
              {sessionDone ? (
                <ReviewSessionSummary key="summary" stats={sessionStats} />
              ) : currentTask && currentCardState ? (
                <ReviewMainCard
                  key={currentItem!.queueId}
                  task={currentTask}
                  cardState={currentCardState}
                  isRelearn={currentItem!.isRelearn}
                  isSubmitting={isSubmitting}
                  onRate={handleRate}
                />
              ) : null}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <ReviewTaskSidebar
            taskMap={taskMap}
            originalOrder={originalOrder}
            cardStates={cardStates}
            currentTaskId={currentItem?.taskId ?? null}
            total={initialData.sessionTotal}
            completed={totalCompleted}
          />
        </div>
      </div>
    </div>
  );
}

const DotBg = () => (
  <div
    className="absolute inset-0 pointer-events-none opacity-[0.6]"
    style={{
      backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
      backgroundSize: '24px 24px',
    }}
  />
);
