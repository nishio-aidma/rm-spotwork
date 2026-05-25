import type { DocumentData, Timestamp } from "firebase/firestore";
import type { Job, JobStatus, JobWorkType } from "@/types";

export const WORK_TYPE_LABELS: Record<JobWorkType, string> = {
  form_post: "フォーム投稿",
  list_creation: "リスト作成",
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  draft: "下書き",
  open: "募集中",
  assigned: "割当済",
  in_progress: "作業中",
  completed: "完了",
  cancelled: "キャンセル",
};

export function toJob(id: string, data: DocumentData): Job {
  return {
    id,
    createdBy: data.createdBy ?? "",
    title: data.title ?? "",
    workType: data.workType ?? "form_post",
    description: data.description ?? "",
    manualUrl: data.manualUrl ?? undefined,
    spreadsheetUrl: data.spreadsheetUrl ?? undefined,
    referenceUrl: data.referenceUrl ?? undefined,
    workerLimit: data.workerLimit ?? 0,
    status: data.status ?? "open",
    workerId: data.workerId ?? undefined,
    reward: data.reward ?? undefined,
    deadline: data.deadline as Timestamp | undefined,
    createdAt: data.createdAt as Timestamp,
    updatedAt: data.updatedAt as Timestamp,
  };
}

export function formatTimestamp(ts: Timestamp | undefined): string {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatReward(reward: number | undefined): string {
  if (reward == null) return "未設定";
  return `¥${reward.toLocaleString("ja-JP")}`;
}
