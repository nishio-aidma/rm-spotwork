import type { ReactNode } from "react";
import type { Job } from "@/types";
import {
  formatTimestamp,
  formatReward,
  WORK_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/jobUtils";

export function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function UrlLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-blue-600 underline"
    >
      {url}
    </a>
  );
}

const STATUS_BADGE_CLASS: Record<Job["status"], string> = {
  draft: "bg-slate-100 text-slate-600",
  open: "bg-emerald-100 text-emerald-800",
  assigned: "bg-violet-100 text-violet-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-blue-100 text-blue-800",
  cancelled: "bg-red-100 text-red-800",
};

export function JobDetailHeader({ job }: { job: Job }) {
  const badgeClass =
    STATUS_BADGE_CLASS[job.status] ?? STATUS_BADGE_CLASS.draft;

  return (
    <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
      <span
        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}
      >
        {STATUS_LABELS[job.status] ?? job.status}
      </span>
      <h1 className="mt-2 text-lg font-semibold leading-snug text-slate-800 sm:text-xl">
        {job.title}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {WORK_TYPE_LABELS[job.workType] ?? job.workType}
      </p>
    </div>
  );
}

/** 仕様で指定された主要項目 + 補足情報 */
export function JobDetailFields({ job }: { job: Job }) {
  return (
    <dl className="px-4 sm:px-6">
      <DetailRow label="業務タイプ">
        {WORK_TYPE_LABELS[job.workType] ?? job.workType}
      </DetailRow>
      <DetailRow label="報酬">{formatReward(job.reward)}</DetailRow>
      <DetailRow label="納期">{formatTimestamp(job.deadline)}</DetailRow>
      <DetailRow label="参照サイトURL">
        {job.referenceUrl ? (
          <UrlLink url={job.referenceUrl} />
        ) : (
          <span className="text-slate-400">未設定</span>
        )}
      </DetailRow>
      <DetailRow label="募集人数">{job.workerLimit} 名</DetailRow>
      <DetailRow label="概要">
        <p className="whitespace-pre-wrap">{job.description}</p>
      </DetailRow>
      {job.manualUrl && (
        <DetailRow label="マニュアルURL">
          <UrlLink url={job.manualUrl} />
        </DetailRow>
      )}
      {job.spreadsheetUrl && (
        <DetailRow label="スプレッドシートURL">
          <UrlLink url={job.spreadsheetUrl} />
        </DetailRow>
      )}
      <DetailRow label="作成日">{formatTimestamp(job.createdAt)}</DetailRow>
    </dl>
  );
}
