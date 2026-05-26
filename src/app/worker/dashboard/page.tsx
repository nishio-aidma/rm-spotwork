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
            if (myLogs.length === 0) {
              monthlySec += (j.totalAccumulatedSeconds || 0);
            }
          }
        });

        if (myLogs.length > 0) {
          monthlySec = 0;
          myLogs.forEach((log: any) => {
            if (log.timestamp) {
              const d = log.timestamp.toDate();
              if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) monthlySec += (log.seconds || 0);
            }
          });
        }

        setStats({ monthlySeconds: monthlySec, monthlyCompleted: monthlyComp, activeCount: active, reviewCount: review });
        setRecentJobs(myJobs.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 5));
      } catch (e) { 
        console.error("Dashboard calculation error:", e); 
      } finally { 
        setLoading(false); 
      }
    }
    if (!authLoading) fetchDashboardData();
  }, [user, authLoading, viewDate]);

  if (authLoading || loading) return <WorkerShell title="ダッシュボード"><div className="p-10 text-slate-400 text-center text-sm">読み込み中...</div></WorkerShell>;

  const monthStr = viewDate.getMonth() + 1;

  return (
    <WorkerShell title="ダッシュボード" subTitle="業務概要と進捗状況">
      <div className="max-w-5xl mx-auto space-y-6 pb-20 text-slate-800 font-sans">
        
        {/* クイックアクション */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/worker/jobs" className="flex items-center justify-between px-6 py-4 bg-slate-900 rounded-2xl text-white shadow-lg hover:bg-slate-800 transition-all group">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔍</span>
              <span className="text-xs font-bold tracking-tight">新しい案件を探す</span>
            </div>
            <span className="text-xs opacity-30 group-hover:opacity-100 transition-opacity">≫</span>
          </Link>
          <Link href="/worker/my-jobs" className="flex items-center justify-between px-6 py-4 bg-white border border-slate-200 rounded-2xl text-slate-800 shadow-sm hover:border-slate-300 transition-all">
            <div className="flex items-center gap-3">
              <span className="text-xl">⏳</span>
              <span className="text-xs font-bold tracking-tight">進行中のタスクを確認</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{stats.activeCount}</span>
              <span className="text-xs text-slate-300">≫</span>
            </div>
          </Link>
        </div>

        {/* 月次セレクター */}
        <div className="flex items-center justify-between bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2">
            <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full text-slate-400 transition-colors">〈</button>
            <h2 className="text-[12px] font-bold text-slate-700 mx-2">
              {viewDate.getFullYear()}年 {monthStr}月 <span className="text-[9px] text-slate-300 font-bold ml-1 uppercase tracking-widest">の実績</span>
            </h2>
            <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full text-slate-400 transition-colors">〉</button>
          </div>
          <button onClick={() => setViewDate(new Date())} className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors uppercase tracking-tighter">今月へ</button>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative group">
            <StatBox label={`${monthStr}月の稼働時間`} value={formatTime(stats.monthlySeconds)} isMain />
            <Link href="/worker/work-logs" className="absolute bottom-4 right-4 text-[9px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-all">
              詳細ログ ≫
            </Link>
          </div>
          <StatBox label={`${monthStr}月の完了案件`} value={stats.monthlyCompleted} unit="件" />
          <StatBox label="現在の検収待ち" value={stats.reviewCount} unit="件" isHighlight={stats.reviewCount > 0} />
        </div>

        {/* 最近のアクティビティ */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">最近の活動履歴</span>
          </div>
          <div className="divide-y divide-slate-50">
            {recentJobs.length > 0 ? recentJobs.map((job) => (
              <Link key={job.id} href={`/worker/jobs/${job.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    job.status === 'working' ? 'bg-indigo-500' : 
                    job.status === 'review' ? 'bg-amber-400' : 
                    job.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200'
                  }`} />
                  <div>
                    <div className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-600 transition-colors truncate max-w-[200px] md:max-w-md">
                      {job.title}
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                      {job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono text-slate-400 text-[10px]">
                  {formatTime(job.totalAccumulatedSeconds || 0)}
                </div>
              </Link>
            )) : (
              <div className="p-12 text-center text-[10px] text-slate-300 italic">案件履歴はまだありません</div>
            )}
          </div>
        </section>
      </div>
    </WorkerShell>
  );
}

const StatBox = ({ label, value, unit, isHighlight, isMain }: any) => (
  <div className={`bg-white p-6 rounded-2xl border transition-all shadow-sm ${
    isMain ? "border-slate-900 ring-1 ring-slate-900/5" : 
    isHighlight ? "border-amber-200 bg-amber-50/30" : "border-slate-100"
  }`}>
    <span className={`text-[9px] font-bold uppercase tracking-widest mb-2 block ${isMain ? "text-slate-900" : "text-slate-400"}`}>
      {label}
    </span>
    <div className="flex items-baseline gap-1">
      <span className={`text-xl font-bold tracking-tight ${isMain ? "text-slate-900" : "text-slate-800"}`}>
        {value}
      </span>
      {unit && <span className="text-[10px] font-bold text-slate-400">{unit}</span>}
    </div>
  </div>
);