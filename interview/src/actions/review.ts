"use server";

import { prisma } from "@/lib/db";
import { calculateNextReview } from "@/lib/srs";
import { revalidatePath } from "next/cache";
import { getNextReviewDate } from "@/lib/utils";
import { SessionPath } from "@/types/review";

/**
 * Maps a session path to an SRS grade.
 *
 * direct          → 4  (normal success, E-Factor improves)
 * vague-mastered  → 4  (合意困难: reviewing at lower recall is equally good)
 * forget-mastered → 3  (relearned and then succeeded; shorter interval growth)
 * failed          → 0  (never mastered in session; full reset)
 */
function pathToGrade(path: SessionPath): number {
  switch (path) {
    case "direct":          return 4;
    case "vague-mastered":  return 4;
    case "forget-mastered": return 3;
    case "failed":          return 0;
  }
}

/**
 * Submit a review result using the session path (new session-aware version).
 * Called once per card when the card exits the session queue.
 */
export async function submitReviewWithPath(
  progressId: string,
  sessionPath: SessionPath
) {
  const grade = pathToGrade(sessionPath);
  return _submitReview(progressId, grade);
}

/** Legacy single-call submit (kept for backward compatibility if needed) */
export async function submitReviewAction(progressId: string, rating: number) {
  return _submitReview(progressId, rating);
}

async function _submitReview(progressId: string, grade: number) {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return { success: false, error: "Unauthorized" };

    const progress = await prisma.progress.findUnique({
      where: { id: progressId },
      include: { problem: true },
    });

    if (!progress || progress.userId !== user.id) {
      return { success: false, error: "Progress not found" };
    }

    const { nextInterval, nextEasiness, status } = calculateNextReview({
      currentInterval: progress.interval,
      currentEasiness: progress.easiness,
      grade,
      difficulty: progress.problem.difficulty,
      reviewCount: progress.reviewCount,
    });

    const nextReviewDate = getNextReviewDate(nextInterval);

    await prisma.progress.update({
      where: { id: progressId },
      data: {
        masteryLevel: grade,
        easiness: nextEasiness,
        interval: nextInterval,
        status: status === "Mastered" ? "Solved" : "Reviewing",
        reviewCount: { increment: 1 },
        lastReview: new Date(),
        nextReview: nextReviewDate,
      },
    });

    revalidatePath("/home");
    revalidatePath("/questions");

    return { success: true, nextReview: nextReviewDate, interval: nextInterval };
  } catch (error) {
    console.error("Review error:", error);
    return { success: false, error: "Failed to submit review" };
  }
}
