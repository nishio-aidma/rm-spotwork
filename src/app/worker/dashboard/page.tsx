"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import WorkerShell from "@/components/WorkerShell";
import Link from "next/link";

export default function WorkerDashboard() {
  const { user, loading: authLoading } = useRequireAuth("worker");
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [stats, setStats] = useState({ monthlySeconds: 0, monthlyCompleted: 0, activeCount: 0, reviewCount: 0 });
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const changeMonth = (diff: number) => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + diff, 1));

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) return;
      setLoading(true);
      try {
        const currentYear = viewDate.getFullYear();
        const currentMonth = viewDate.getMonth();

        const [snapJobs, snapLogs] = await Promise.all([
          getDocs(query(collection(db, "jobs"), where("workerId", "==", user.uid))),
          getDocs(query(collection(db, "workLogs"), where("workerId", "==", user.uid)))
        ]);

        const myJobs = snapJobs.docs.map(d => ({ id: d.id, ...d.data() }));
        const myLogs = snapLogs.docs.map(d => d.data());

        let monthlySec = 0, monthlyComp = 0, active = 0, review = 0;

        myJobs.forEach((j: any) => {
          if (j.status === "working" || j.status === "paused") active++;
          if (j.status === "review") review++;
          
          const targetDate = j.completedAt?.toDate() || j.submittedAt?.toDate() || j.updatedAt?.toDate();
          if (targetDate && targetDate.getFullYear() === currentYear && targetDate.getMonth() === currentMonth) {
            if (j.status === "completed") monthlyComp++;
            // ログがまだ1件もない場合の救済：今月動いた案件の総時間を加算
            if (myLogs.length === 0) {
              monthlySec += (j.totalAccumulatedSeconds || 0);
            }
          }
        });

        // ログがある場合はログを優先して集計
        if (myLogs.length > 0) {
          monthlySec = 0; // リセットして正確に集計
          myLogs.forEach((log: any) => {
            if (log.timestamp) {
              const d = log.timestamp.toDate();
              if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) monthlySec += (log.seconds || 0);
            }
          });
        }

        setStats({ monthlySeconds: monthlySec, monthlyCompleted: monthlyComp, activeCount: active, reviewCount: review });
        setRecentJobs(myJobs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5));
      } catch (e) { console.error("Dashboard calculation error:", e); } finally { setLoading(false); }
    }
    if (!authLoading) fetchDashboardData();
  }, [user, authLoading, viewDate]);

  if (authLoading || loading) return <WorkerShell title="Dashboard"><div className="p-10 italic text-slate-400 text-center">Loading...</div></WorkerShell>;

  const monthStr = viewDate.getMonth() + 1;

  return (
    <WorkerShell title="Dashboard" subTitle="マイページ">
      <div className="space-y-4 font-sans text-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Link href="/worker/jobs" className="flex items-center justify-between px-5 py-3.5 bg-indigo-600 rounded-xl text-white shadow hover:bg-indigo-700 transition-all group">
            <div className="flex items-center gap-3"><span className="text-lg">🔍</span><span className="text-[12px] font-black">新しい案件を探す</span></div>
            <span className="text-xs opacity-50">→</span>
          </Link>
          <Link href="/worker/my-jobs" className="flex items-center justify-between px-5 py-3.5 bg-white border border-slate-200 rounded-xl text-slate-800 shadow-sm hover:border-indigo-300 transition-all">
            <div className="flex items-center gap-3"><span className="text-lg">⏳</span><span className="text-[12px] font-black">進行中のタスクを確認</span></div>
            <div className="flex items-center gap-2"><span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{stats.activeCount}</span><span className="text-xs text-slate-300">→</span></div>
          </Link>
        </div>

        <div className="flex items-center justify-between bg-slate-50 px-4 py-1.5 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1">
            <button onClick={() => changeMonth(-1)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-full text-slate-400 text-[10px]">〈</button>
            <h2 className="text-[11px] font-black text-slate-700 mx-2">{viewDate.getFullYear()}年 {monthStr}月 <span className="text-[8px] text-slate-300 font-normal ml-1">RESULTS</span></h2>
            <button onClick={() => changeMonth(1)} className="w-7 h-7 flex items-center justify-center hover:bg-white rounded-full text-slate-400 text-[10px]">〉</button>
          </div>
          <button onClick={() => setViewDate(new Date())} className="text-[8px] font-bold text-indigo-400 uppercase">Today</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative group">
            <StatBox label={`${monthStr}月の稼働時間 (全作業)`} value={formatTime(stats.monthlySeconds)} isMain />
            <Link href="/worker/work-logs" className="absolute bottom-2 right-4 text-[9px] font-bold text-indigo-400 hover:text-indigo-600 flex items-center gap-0.5 transition-all">
              稼働時間一覧へ <span className="text-[11px]">≫</span>
            </Link>
          </div>
          <StatBox label={`${monthStr}月の完了案件`} value={stats.monthlyCompleted} unit="件" />
          <StatBox label="現在の検収待ち" value={stats.reviewCount} unit="件" isHighlight={stats.reviewCount > 0} />
        </div>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex justify-between">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Recent Activity</span>
          </div>
          {recentJobs.length > 0 ? recentJobs.map((job) => (
            <Link key={job.id} href={`/worker/jobs/${job.id}`} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-1 h-1 rounded-full ${job.status === 'working' ? 'bg-indigo-500' : job.status === 'review' ? 'bg-amber-400' : job.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                <div>
                  <div className="text-[10px] font-bold text-slate-600 truncate max-w-[180px] md:max-w-md">{job.title}</div>
                  <div className="text-[8px] text-slate-300 font-bold uppercase">{job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}</div>
                </div>
              </div>
              <div className="text-right font-mono text-slate-300 text-[9px]">{formatTime(job.totalAccumulatedSeconds || 0)}</div>
            </Link>
          )) : <div className="p-6 text-center text-[9px] text-slate-300 italic">案件履歴なし</div>}
        </section>
      </div>
    </WorkerShell>
  );
}

const StatBox = ({ label, value, unit, isHighlight, isMain }: any) => (
  <div className={`bg-white p-4 rounded-xl border transition-all shadow-sm ${isMain ? "border-indigo-400 ring-2 ring-indigo-500/5" : isHighlight ? "border-amber-200 bg-amber-50/20" : "border-slate-100"}`}>
    <span className={`text-[8px] font-black uppercase tracking-widest mb-1 block ${isMain ? "text-indigo-600" : "text-slate-400"}`}>{label}</span>
    <div className="flex items-baseline gap-1"><span className={`text-base font-black ${isMain ? "text-indigo-700" : "text-slate-800"}`}>{value}</span>{unit && <span className="text-[9px] font-bold text-slate-400">{unit}</span>}</div>
  </div>
);