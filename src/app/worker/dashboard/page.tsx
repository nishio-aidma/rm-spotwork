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
  const [newJobs, setNewJobs] = useState<any[]>([]);

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

        const [snapJobs, snapLogs, snapOpenJobs] = await Promise.all([
          getDocs(query(collection(db, "jobs"), where("workerId", "==", user.uid))),
          getDocs(query(collection(db, "workLogs"), where("workerId", "==", user.uid))),
          getDocs(query(collection(db, "jobs"), where("status", "==", "open")))
        ]);

        const myJobs = snapJobs.docs.map(d => ({ id: d.id, ...d.data() }));
        const myLogs = snapLogs.docs.map(d => d.data());
        const openJobs = snapOpenJobs.docs.map(d => ({ id: d.id, ...d.data() }) as any);

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

        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

        const filteredNewJobs = openJobs.filter((job: any) => {
          if (!job.createdAt) return false;
          const createdDate = job.createdAt.toDate ? job.createdAt.toDate() : new Date(job.createdAt);
          return createdDate >= threeDaysAgo;
        });

        filteredNewJobs.sort((a: any, b: any) => {
          const deadlineA = a.deadline && typeof a.deadline === "string" && a.deadline.trim() !== "" ? a.deadline : "9999-12-31";
          const deadlineB = b.deadline && typeof b.deadline === "string" && b.deadline.trim() !== "" ? b.deadline : "9999-12-31";
          return deadlineA.localeCompare(deadlineB);
        });

        setNewJobs(filteredNewJobs);

      } catch (e) { 
        console.error("Dashboard calculation error:", e); 
      } finally { 
        setLoading(false); 
      }
    }
    if (!authLoading) fetchDashboardData();
  }, [user, authLoading, viewDate]);

  if (authLoading || loading) return <WorkerShell title="ダッシュボード"><div className="p-10 text-slate-400 text-center text-xs font-bold">リアルタイムデータを取得中...</div></WorkerShell>;

  const monthStr = viewDate.getMonth() + 1;

  return (
    <WorkerShell title="メインメニュー" subTitle="業務概要と進捗状況">
      <div className="max-w-full mx-auto space-y-4">
        
        {/* 💡【超絶新設】ワーカー専用：公式ご利用マニュアル3連クイックリンクボード */}
        <div className="bg-slate-900 text-white p-4 rounded border border-slate-800 shadow-md select-none animate-fade-in space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-[#0082C8] text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">OFFICIAL MANUALS</span>
            <h4 className="text-xs font-black text-slate-100 tracking-wide">すきわ〜く 公式ご利用マニュアル</h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* マニュアル1 */}
            <a 
              href="https://docs.google.com/document/d/17IVpVYgvguhLSh7ct6BgYQCXqot5sDRTQ0GLs1MsILo/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 p-3 rounded transition-all active:scale-98 flex flex-col justify-between group"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-sky-400 font-bold block">STEP 01</span>
                <p className="text-xs font-black text-slate-100 group-hover:text-[#0082C8] transition-colors leading-snug">お仕事の探し方から引き受けて作業を完了するまで</p>
              </div>
              <span className="text-[10px] text-slate-400 font-bold mt-4 block text-right">手順を確認する ↗</span>
            </a>

            {/* マニュアル2 */}
            <a 
              href="https://docs.google.com/document/d/1rGbaB_abOkhP8MbTEdBS1bomX8NMl7AkYWHKvlwYyyM/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700/40 p-3 rounded transition-all active:scale-98 flex flex-col justify-between group"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-sky-400 font-bold block">STEP 02</span>
                <p className="text-xs font-black text-slate-100 group-hover:text-[#0082C8] transition-colors leading-snug">ダッシュボードの見方について（各数値・履歴解説）</p>
              </div>
              <span className="text-[10px] text-slate-400 font-bold mt-4 block text-right">見方を確認する ↗</span>
            </a>

            {/* マニュアル3 */}
            <a 
              href="https://docs.google.com/document/d/1mQ3LEKkcAVKgG-6O44E7SURzdhVNSw7GiG41ul_K0yw/edit?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-slate-800/50 hover:bg-slate-800 border border-rose-900/60 p-3 rounded transition-all active:scale-98 flex flex-col justify-between group bg-gradient-to-br from-slate-900 via-slate-900 to-rose-950/20"
            >
              <div className="space-y-1">
                <span className="text-[10px] text-rose-400 font-black block">⚠️ IMPORTANT</span>
                <p className="text-xs font-black text-slate-100 group-hover:text-rose-400 transition-colors leading-snug">毎月稼働時間の提出が必要です（必須ルール）</p>
              </div>
              <span className="text-[10px] text-slate-400 font-bold mt-4 block text-right">ルールを確認する ↗</span>
            </a>
          </div>
        </div>

        {/* メイン実績エリア（左右2分割のグリッド配置） */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* 【左側エリア：7マス分】 */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* 月次セレクター */}
            <div className="flex items-center justify-between bg-white px-3 py-2 rounded border-2 border-slate-300 shadow-sm">
              <div className="flex items-center gap-1">
                <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 font-bold transition-colors">〈</button>
                <h2 className="text-xs font-black text-slate-800 mx-2">
                  {viewDate.getFullYear()}年 {monthStr}月 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">の実績</span>
                </h2>
                <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded text-slate-600 font-bold transition-colors">〉</button>
              </div>
              <button onClick={() => setViewDate(new Date())} className="text-[11px] font-black text-[#0082C8] hover:underline uppercase tracking-tighter">今月へ</button>
            </div>

            {/* 統計カード */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-3 bg-white border-2 border-slate-300 rounded relative group">
                <span className="text-[10px] font-black text-slate-400 block uppercase">{monthStr}月の稼働</span>
                <div className="text-sm font-black text-slate-900 mt-2 truncate">{formatTime(stats.monthlySeconds)}</div>
                <Link href="/worker/work-logs" className="absolute bottom-1 right-2 text-[9px] font-bold text-[#0082C8] hover:underline">
                  詳細 →
                </Link>
              </div>

              <div className="p-3 bg-white border-2 border-slate-300 rounded">
                <span className="text-[10px] font-black text-slate-400 block uppercase">完了案件</span>
                <div className="text-xl font-black text-slate-900 mt-1">{stats.monthlyCompleted}<span className="text-xs font-normal text-slate-500 ml-0.5">件</span></div>
              </div>

              <div className={`p-3 bg-white border-2 rounded ${stats.reviewCount > 0 ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'}`}>
                <span className="text-[10px] font-black text-slate-400 block uppercase">検収待ち</span>
                <div className="text-xl font-black text-slate-900 mt-1">{stats.reviewCount}<span className="text-xs font-normal text-slate-500 ml-0.5">件</span></div>
              </div>
            </div>

            {/* クイックアクション：特大フラットボタン */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/worker/jobs" className="flex flex-col items-center justify-center p-8 bg-[#0082C8] hover:bg-[#0072B5] text-white border border-black/10 rounded shadow-sm transition-all group text-center">
                <span className="text-3xl mb-2">🔍</span>
                <span className="text-sm font-black tracking-wider">新しい案件を探す</span>
                <span className="text-[10px] text-white/70 mt-1 font-medium">公開中の仕事一覧画面へ</span>
              </Link>

              <Link href="/worker/my-jobs" className="flex flex-col items-center justify-center p-8 bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-900 shadow-sm transition-all group text-center relative">
                <span className="text-3xl mb-2">⏳</span>
                <span className="text-sm font-black tracking-wider">進行中のタスク確認</span>
                <span className="text-[10px] text-slate-400 mt-1 font-medium">現在対応中の案件を開きます</span>
                {stats.activeCount > 0 && (
                  <span className="absolute top-3 right-3 bg-rose-500 text-white text-xs font-black px-2 py-0.5 rounded shadow-sm">
                    {stats.activeCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* 【右側エリア：5マス分】 */}
          <div className="lg:col-span-5">
            <div className="bg-white border-2 border-slate-300 rounded shadow-sm flex flex-col h-full">
              <div className="bg-slate-100 p-3 border-b border-slate-300 flex justify-between items-center">
                <span className="text-xs font-black text-slate-700">最近の活動履歴明細</span>
                <span className="text-[10px] font-mono font-bold text-slate-400">LATEST</span>
              </div>

              <div className="divide-y divide-slate-200 overflow-y-auto max-h-[340px]">
                {recentJobs.length > 0 ? recentJobs.map((job) => (
                  <Link key={job.id} href={`/worker/jobs/${job.id}`} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors group">
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                      <span className={`w-2 h-2 flex-shrink-0 block ${
                        job.status === 'working' ? 'bg-blue-500' : 
                        job.status === 'review' ? 'bg-amber-400' : 
                        job.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-300'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <div className="font-black text-slate-900 truncate group-hover:text-[#0082C8] transition-colors">
                          {job.title}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-0.5">
                          {job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono text-slate-500 font-bold whitespace-nowrap">
                      {formatTime(job.totalAccumulatedSeconds || 0)}
                    </div>
                  </Link>
                )) : (
                  <div className="p-10 text-center text-[10px] text-slate-400 italic font-medium">案件履歴はまだありません</div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* 新着案件コーナー */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
          <div className="bg-slate-950 text-white p-3 border-b-2 border-slate-300 flex justify-between items-center select-none">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black tracking-wider">✨ 直近3日以内に新規追加された案件</span>
              <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse uppercase">NEW</span>
            </div>
            <span className="text-[9px] font-mono font-bold text-slate-400">🔥 SPEED ENTRY</span>
          </div>

          <div className="divide-y divide-slate-200 bg-white">
            {newJobs.length > 0 ? (
              newJobs.map((job) => (
                <div key={job.id} className="p-3 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors text-xs font-medium">
                  
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="bg-slate-100 border border-slate-300 text-[10px] font-bold px-1.5 py-0.5 rounded text-slate-600 whitespace-nowrap flex-shrink-0">
                      {job.jobType === 'form_posting' ? '✉️ フォーム' : '📋 リスト'}
                    </span>
                    
                    {job.urgency === "3" ? (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex-shrink-0">至急</span>
                    ) : job.urgency === "2" ? (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase flex-shrink-0">高め</span>
                    ) : (
                      <span className="bg-slate-50 text-slate-500 border border-slate-200 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">通常</span>
                    )}

                    <div className="font-black text-slate-900 truncate pl-1" title={job.title}>
                      {job.title}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <span className="text-[11px] text-slate-500 font-mono">
                      ⏳ 期日：{job.deadline || "未設定"}
                    </span>
                    <Link 
                      href={`/worker/jobs/${job.id}`}
                      className="text-[#0082C8] hover:underline font-black text-[11px] whitespace-nowrap"
                    >
                      詳細 →
                    </Link>
                  </div>

                </div>
              ))
            ) : (
              <div className="text-center p-6 text-slate-400 italic text-xs font-medium bg-slate-50/50">
                現在、直近3日以内に新規追加された案件はありません。
              </div>
            )}
          </div>
        </div>

      </div>
    </WorkerShell>
  );
}