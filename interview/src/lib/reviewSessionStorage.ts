/**
 * LocalStorage persistence for the in-progress review session.
 *
 * Key:     review_session_v1
 * Saved:   after every rating action (useEffect in ReviewPageClient)
 * Restored: on page mount — validates date + pending cards still in today's due list
 * Cleared:  when the session is fully done (sessionDone = true)
 *
 * Why NOT exact-match on taskIds:
 *   When a card is mastered and written to DB its nextReview moves to the future,
 *   so the server won't include it in the next load. An exact match would always
 *   fail after even one card is reviewed. Instead we check that all NON-terminal
 *   cards from the saved session are still present in today's due list.
 */

import { QueueItem, CardSessionState, SessionStats } from '@/types/review';

const STORAGE_KEY = 'review_session_v1';
const VERSION = 1;

interface PersistedSession {
  version: number;
  /** 'YYYY-MM-DD' — sessions never survive across calendar days */
  date: string;
  /** Task IDs from the original session start (superset of today's due list) */
  taskIds: string[];
  queue: QueueItem[];
  currentIndex: number;
  /** Map serialised as [key, value][] for JSON compatibility */
  cardStates: [string, CardSessionState][];
  sessionStats: SessionStats;
}

export interface RestoredSession {
  queue: QueueItem[];
  currentIndex: number;
  cardStates: Map<string, CardSessionState>;
  sessionStats: SessionStats;
  /** Total cards when this session originally started (stays fixed across reloads) */
  originalTotal: number;
  /** The task IDs from session start — must be preserved for future saves */
  sessionTaskIds: string[];
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Try to load a saved session for today.
 *
 * Validation rules (returns null if any fail):
 *  1. version matches
 *  2. date === today
 *  3. every non-terminal card in the saved session is present in todayTaskIds
 *     (terminal cards are already written to DB and won't be in today's list — that's fine)
 *  4. the current queue position points to a card that exists in todayTaskIds
 */
export function loadSession(todayTaskIds: string[]): RestoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data: PersistedSession = JSON.parse(raw);

    if (data.version !== VERSION) return null;
    if (data.date !== todayStr()) return null;

    const todaySet = new Set(todayTaskIds);
    const savedStates = new Map<string, CardSessionState>(data.cardStates);

    // Find all cards that haven't reached a terminal state yet
    const pendingIds = data.taskIds.filter((id) => {
      const s = savedStates.get(id);
      return !s || (s.sessionStatus !== 'mastered' && s.sessionStatus !== 'failed');
    });

    const missingPending = pendingIds.filter((id) => !todaySet.has(id));
    // All pending cards must still be in today's due list
    if (missingPending.length > 0) return null;

    // Session must not already be past the end (completed session that wasn't cleared)
    if (data.currentIndex >= data.queue.length) return null;

    // The card at the current position must be reachable
    const currentItem = data.queue[data.currentIndex];
    if (currentItem && !todaySet.has(currentItem.taskId)) return null;

    // Merge: add fresh state entries for any cards in todayTaskIds not seen before
    // (edge case: daily limit was raised and new cards appeared)
    for (const id of todayTaskIds) {
      if (!savedStates.has(id)) {
        savedStates.set(id, {
          taskId: id,
          sessionFailCount: 0,
          hasBeenShown: false,
          hadForgetFailure: false,
          sessionStatus: 'pending',
          sessionPath: 'direct',
        });
      }
    }

    return {
      queue: data.queue,
      currentIndex: data.currentIndex,
      cardStates: savedStates,
      sessionStats: data.sessionStats,
      originalTotal: data.taskIds.length,
      sessionTaskIds: data.taskIds,
    };
  } catch {
    return null;
  }
}

/** Serialise and persist the current session state. */
export function saveSession(params: {
  taskIds: string[];
  queue: QueueItem[];
  currentIndex: number;
  cardStates: Map<string, CardSessionState>;
  sessionStats: SessionStats;
}): void {
  try {
    const payload: PersistedSession = {
      version: VERSION,
      date: todayStr(),
      taskIds: params.taskIds,
      queue: params.queue,
      currentIndex: params.currentIndex,
      cardStates: Array.from(params.cardStates.entries()),
      sessionStats: params.sessionStats,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('[saveSession] FAILED:', e);
  }
}

/** Remove the saved session (called when the session completes). */
export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
