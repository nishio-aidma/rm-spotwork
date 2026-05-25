import type { Timestamp } from "firebase/firestore";

/** 認証ユーザーの役割（owner: 発注者 / worker: 受注者） */
export type UserRole = "owner" | "worker";

/** users コレクション */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type JobStatus =
  | "draft"
  | "open"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

/** 業務タイプ */
export type JobWorkType = "form_post" | "list_creation";

/** jobs コレクション */
export interface Job {
  id: string;
  createdBy: string;
  title: string;
  workType: JobWorkType;
  description: string;
  manualUrl?: string;
  spreadsheetUrl?: string;
  referenceUrl?: string;
  workerLimit: number;
  status: JobStatus;
  workerId?: string;
  reward?: number;
  deadline?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type WorkSessionStatus = "in_progress" | "completed" | "approved";

/** work_sessions コレクション */
export interface WorkSession {
  id: string;
  jobId: string;
  workerId: string;
  status: WorkSessionStatus;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** work_reports コレクション */
export interface WorkReport {
  id: string;
  jobId: string;
  workSessionId: string;
  workerId: string;
  content: string;
  submittedAt: Timestamp;
  createdAt: Timestamp;
}

export type PaymentStatus = "pending" | "paid" | "cancelled";

/** payments コレクション */
export interface Payment {
  id: string;
  jobId: string;
  workerId: string;
  ownerId: string;
  amount: number;
  status: PaymentStatus;
  paidAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** activity_logs コレクション */
export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
}

export type WishListStatus = "pending" | "approved" | "rejected";

/** wish_lists コレクション */
export interface WishList {
  id: string;
  workerId: string;
  title: string;
  description: string;
  status: WishListStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
