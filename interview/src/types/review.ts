export interface ReviewTask {
  id: string;
  questionId: string;
  title: string;
  difficulty: string;
  url: string | null;
  slug: string | null;
  masteryLevel: number;
  lastReviewDate: string | null;
  notes?: string | null;
  tags?: string;
  answer?: string | null;
  answerKeywords?: string | null;
  submissions?: {
    language: string;
    code: string;
  }[];
}

export interface ReviewClientProps {
  initialReviews: ReviewTask[];
}

// ─── Session types ────────────────────────────────────────────────────────────

/** Status of a card within the current session */
export type SessionStatus = 'pending' | 'current' | 'relearning' | 'mastered' | 'failed';

/**
 * How the card was finally mastered (determines the SRS grade submitted)
 * direct          → grade 4  (first try, 记得)
 * vague-mastered  → grade 4  (模糊 → 记得, 合意困难 principle)
 * forget-mastered → grade 3  (忘记 → relearned → 记得)
 * failed          → grade 0  (hit repeat limit, never mastered)
 */
export type SessionPath = 'direct' | 'vague-mastered' | 'forget-mastered' | 'failed';

/**
 * One slot in the session queue.
 * A card can appear multiple times (re-insertions), each with its own queueId.
 */
export interface QueueItem {
  /** Unique ID for this queue slot (NOT the task id) */
  queueId: string;
  /** References ReviewTask.id */
  taskId: string;
  /**
   * true  = came from 不记得 → show answer automatically in relearn mode
   * false = came from 模糊   → normal flow with badge
   */
  isRelearn: boolean;
}

/** Per-card session tracking (keyed by taskId, persists across re-insertions) */
export interface CardSessionState {
  taskId: string;
  /** Total times the card was rated non-记得 in this session */
  sessionFailCount: number;
  /** Whether this card has been shown at least once */
  hasBeenShown: boolean;
  /** Whether the card was ever rated 忘记 (affects final SRS path) */
  hadForgetFailure: boolean;
  /** Set once the card is done for the session */
  sessionStatus: SessionStatus;
  sessionPath: SessionPath;
}

/** Aggregate stats for the session summary screen */
export interface SessionStats {
  /** 直接记得 (no relearning needed) */
  direct: number;
  /** 重学后记得 */
  relearned: number;
  /** 达到重复上限仍未掌握 */
  failed: number;
}
