"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import WorkerShell from "@/components/WorkerShell";

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

export default function WorkerJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const { user, loading: authLoading } = useRequireAuth("worker");
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [reportNotes, setReportNotes] = useState("");
  const [liveSeconds, setLiveSeconds] = useState(0);

  useEffect(() => {
    async function fetchJob() {
      if (!user) return;
      const snap = await getDoc(doc(db, "jobs", jobId));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setJob(data);
        setLiveSeconds(data.totalAccumulatedSeconds || 0);
        setReportNotes(data.workerReport || "");
      }
      setLoading(false);
    }
    if (!authLoading) fetchJob();
  }, [jobId, user, authLoading]);

  useEffect(() => {
    let interval: any;
    if (job?.status === "working" && job?.lastStartedAt) {
      interval = setInterval(() => {
        try {
          const start = job.lastStartedAt.toDate().getTime();
          const now = new Date().getTime();
          const diff = Math.floor((now - start) / 1000);
          setLiveSeconds((job.totalAccumulatedSeconds || 0) + diff);
        } catch (e) { console.error("Timer error", e); }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [job]);

  const saveWorkLog = async (seconds: number) => {
    if (seconds <= 0) return;
    await addDoc(collection(db, "workLogs"), {
      jobId, workerId: user.uid, workerName: user.displayName || "Worker",
      seconds, timestamp: serverTimestamp(), jobTitle: job.title
    });
  };

  const handleStartOrResume = async () => {
    setProcessing(true);
    try {
      await updateDoc(doc(db, "jobs", jobId), { workerId: user.uid, status: "working", lastStartedAt: serverTimestamp() });
      window.location.reload();
    } catch (e) { setProcessing(false); }
  };

  const handlePause = async () => {
    if (!job?.lastStartedAt) {
      // 万が一タイマー情報がない場合はステータスだけ変えて復帰させる
      await updateDoc(doc(db, "jobs", jobId), { status: "paused", lastStartedAt: null });
      window.location.reload();
      return;
    }
    setProcessing(true);
    try {
      const now = new Date();
      const diff = Math.floor((now.getTime() - job.lastStartedAt.toDate().getTime()) / 1000);
      await saveWorkLog(diff);
      await updateDoc(doc(db, "jobs", jobId), { status: "paused", totalAccumulatedSeconds: (job.totalAccumulatedSeconds || 0) + diff, lastStartedAt: null });
      window.location.reload();
    } catch (e) { setProcessing(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("作業を終了して検収依頼を出しますか？")) return;
    setProcessing(true);
    try {
      if (job.status === "working" && job.lastStartedAt) {
        const now = new Date();
        const diff = Math.floor((now.getTime() - job.lastStartedAt.toDate().getTime()) / 1000);
        await saveWorkLog(diff);
      }
      await updateDoc(doc(db, "jobs", jobId), { status: "review", totalAccumulatedSeconds: liveSeconds, totalMinutes: Math.ceil(liveSeconds / 60), workerReport: reportNotes, submittedAt: serverTimestamp(), lastStartedAt: null });
      router.push("/worker/dashboard");
    } catch (e) { setProcessing(false); }
  };

  if (authLoading || loading) return <WorkerShell title="Loading..."><div className="p-10 italic">Loading...</div></WorkerShell>;

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const isMyJob = job.workerId === user.uid;
  // ★重要：ステータスがworkingでも、開始時間がない場合は「再開」ボタンを表示する
  const isActuallyRunning = job.status === "working" && job.lastStartedAt;

  return (
    <WorkerShell title="Tracking" subTitle="案件詳細・作業計測">
      <div className="max-w-4xl mx-auto space-y-4 pb-20 font-sans text-slate-900">
        <button onClick={() => router.push("/worker/dashboard")} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-all">← DASHBOARD</button>

        {isMyJob && (job.status === "working" || job.status === "paused") ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex gap-3 flex-1">
                {isActuallyRunning ? (
                  <button onClick={handlePause} disabled={processing} className="flex-1 bg-white border border-slate-200 text-slate-600 py-3 rounded-xl text-[11px] font-bold hover:bg-slate-50 shadow-sm">一時停止 (PAUSE)</button>
                ) : (
                  <button onClick={handleStartOrResume} disabled={processing} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl text-[11px] font-bold hover:bg-indigo-700 shadow-sm">作業を再開 (RESUME)</button>
                )}
                <button onClick={handleSubmit} disabled={processing} className="flex-1 bg-emerald-500 text-white py-3 rounded-xl text-[11px] font-bold hover:bg-emerald-600 shadow-sm">作業を終了 (FINISH)</button>
              </div>
              <div className="ml-6 flex flex-col items-end">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter">Current Total</span>
                <span className="text-sm font-mono font-black text-indigo-600">{formatTime(liveSeconds)}</span>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <h1 className="text-lg font-bold text-slate-800">{job.title}</h1>
              <textarea value={reportNotes} onChange={e => setReportNotes(e.target.value)} placeholder="作業メモ（任意）" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 min-h-[100px] outline-none" />
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex items-center justify-between">
             <h1 className="text-lg font-bold text-slate-800">{job.title}</h1>
             {!isMyJob && job.status === "open" && <button onClick={handleStartOrResume} className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-bold">作業を開始する</button>}
             {job.status === "review" && <span className="bg-amber-50 text-amber-600 px-4 py-2 rounded-lg text-xs font-bold">検収待ち</span>}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatBox label="報酬" value={`¥${job.reward?.toLocaleString()}`} />
          <StatBox label={job.jobType === 'form_posting' ? "抽出サイト" : "参照URL"} value={job.listName || job.refUrl} />
          <StatBox label="期日" value={job.deadline || "-"} />
          <StatBox label="予定件数" value={String(job.count || job.createCount || "-")} />
        </div>
      </div>
    </WorkerShell>
  );
}

const StatBox = ({ label, value }: any) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200">
    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</span>
    <div className="text-xs font-bold text-slate-700 truncate">{value || "-"}</div>
  </div>
);