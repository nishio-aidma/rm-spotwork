"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, index) => {
    if (part.match(urlRegex)) {
      return <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline break-all">{part}</a>;
    }
    return <span key={index}>{part}</span>;
  });
};

const formatTime = (s: number) => {
  if (!s) return "0秒";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
};

export default function OwnerJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJob() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "jobs", jobId));
        if (snap.exists()) setJob({ id: snap.id, ...snap.data() });
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    if (!authLoading) fetchJob();
  }, [jobId, user, authLoading]);

  const handleStatusUpdate = async (newStatus: string) => {
    const actionLabel = newStatus === "completed" ? "承認（完了）" : "差し戻し";
    if (!confirm(`この案件を${actionLabel}してもよろしいですか？`)) return;
    try {
      await updateDoc(doc(db, "jobs", jobId), { 
        status: newStatus,
        completedAt: newStatus === "completed" ? serverTimestamp() : null,
        lastStartedAt: null // 差し戻し時はタイマーを確実にリセット
      });
      alert("更新しました");
      window.location.reload();
    } catch (e) { alert("失敗しました"); }
  };

  if (authLoading || loading) return <OwnerShell title="Loading..."><div className="p-10 italic">Loading...</div></OwnerShell>;
  if (!job) return <OwnerShell title="Error">案件が見つかりません</OwnerShell>;

  const isFormPosting = job.jobType === "form_posting";

  return (
    <OwnerShell title="Admin" subTitle="案件詳細・検収管理">
      <div className="max-w-5xl mx-auto space-y-4 pb-20 font-sans text-slate-900">
        <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-all">← BACK TO LIST</button>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div>
              <StatusBadge status={job.status} />
              <h1 className="text-xl font-bold text-slate-950 mt-2 tracking-tight">{job.title}</h1>
            </div>
            {job.status === "review" && (
              <div className="flex gap-3">
                <button onClick={() => handleStatusUpdate("paused")} className="bg-white border border-slate-200 text-slate-600 px-6 py-2 rounded-xl text-[11px] font-bold hover:bg-slate-50">差し戻す</button>
                <button onClick={() => handleStatusUpdate("completed")} className="bg-teal-500 text-white px-8 py-2 rounded-xl text-[11px] font-black shadow-lg shadow-teal-100">検収を完了する</button>
              </div>
            )}
          </div>

          <div className="p-8">
            {(job.status === "review" || job.status === "completed") && (
              <div className="mb-10 p-6 bg-slate-50 rounded-2xl border border-slate-100 border-l-4 border-l-indigo-500">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Worker Report</h3>
                  <div className="text-right">
                    <span className="text-lg font-mono font-black text-indigo-600">{formatTime(job.totalAccumulatedSeconds)}</span>
                  </div>
                </div>
                <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white p-4 rounded-xl border border-slate-100">{job.workerReport || "報告なし"}</div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Stat label="報酬" value={`¥${job.reward?.toLocaleString()}`} />
              <Stat label={isFormPosting ? "抽出サイト" : "参照URL"} value={job.listName || job.refUrl || "-"} />
              <Stat label="期日" value={job.deadline || "未設定"} />
              <Stat label="予定件数" value={String(job.count || job.createCount || "-")} />
            </div>
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}

const Stat = ({ label, value }: any) => (
  <div>
    <span className="text-[9px] font-black uppercase text-slate-400 mb-1.5 block tracking-widest">{label}</span>
    <div className="text-sm font-bold text-slate-800 break-all">{value ? renderTextWithLinks(String(value)) : "-"}</div>
  </div>
);

const Section = ({ label, content }: any) => (
  <div className="mt-8">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">{label}</label>
    <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-5 text-[11px] text-slate-600 whitespace-pre-wrap">{content ? renderTextWithLinks(content) : "-"}</div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: any = { open: "bg-emerald-50 text-emerald-600 ring-emerald-100", working: "bg-indigo-50 text-indigo-600 ring-indigo-100", paused: "bg-amber-50 text-amber-600 ring-amber-100", review: "bg-amber-50 text-amber-600 ring-amber-100", completed: "bg-blue-50 text-blue-600 ring-blue-100" };
  const label: any = { open: "募集中", working: "進行中", paused: "差し戻し中", review: "検収待ち", completed: "完了" };
  return <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ring-1 ring-inset ${map[status]}`}>{label[status]}</span>;
};