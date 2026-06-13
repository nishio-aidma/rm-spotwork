"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  
  const [stats, setStats] = useState({ 
    totalJobs: 0, 
    activeJobs: 0, 
    reviewJobs: 0, 
    totalSeconds: 0,
    draftJobs: 0,
    openJobs: 0,
    nearDeadlineJobs: 0,
    overdueJobs: 0 
  });
  
  const [workerStats, setWorkerStats] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]); 
  const [alertJobs, setAlertJobs] = useState<any[]>([]); 
  const [recentComments, setRecentComments] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const formatTextTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? h + 'h' : ''}${m}m${sec}s`;
  };

  const checkNearDeadline = (deadlineStr: string) => {
    if (!deadlineStr) return false;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dDate = new Date(deadlineStr);
      if (isNaN(dDate.getTime())) return false;
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);
      return dDate <= sevenDaysLater && dDate >= today;
    } catch {
      return false;
    }
  };

  const checkIsOverdue = (deadlineStr: string) => {
    if (!deadlineStr) return false;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dDate = new Date(deadlineStr);
      if (isNaN(dDate.getTime())) return false;
      return dDate < today; 
    } catch {
      return false;
    }
  };

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        const [jSnap, uSnap, lSnap] = await Promise.all([
          getDocs(query(collection(db, "jobs"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "users"), where("role", "==", "worker"))),
          getDocs(query(collection(db, "workLogs"), orderBy("timestamp", "desc")))
        ]);

        const allJobs = jSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const userMap: any = {};
        uSnap.docs.forEach(d => {
          const u = d.data();
          userMap[d.id] = `${u.lastName || ""} ${u.firstName || ""}`.trim() || u.name || "不明";
        });

        let totalSec = 0, active = 0, review = 0, draft = 0, open = 0, nearDeadline = 0, overdue = 0;
        const workerAgg: any = {};
        const alertList: any[] = [];
        const commentList: any[] = []; 

        allJobs.forEach((j: any) => {
          if (j.status === "working" || j.status === "paused") active++;
          if (j.status === "review") review++;
          if (j.status === "draft") draft++;
          if (j.status === "open") open++;
          
          if (j.status !== "open" && j.status !== "draft") {
            totalSec += (j.totalAccumulatedSeconds || 0);
          }

          if (j.status !== "completed") {
            if (checkNearDeadline(j.deadline)) {
              nearDeadline++;
            }
            if (checkIsOverdue(j.deadline)) {
              overdue++; 
            }
          }

          if (j.status === "review" || j.urgency === "3" || (j.status !== "completed" && checkIsOverdue(j.deadline))) {
            alertList.push({
              id: j.id,
              title: j.title || "無題の案件",
              status: j.status,
              urgency: j.urgency,
              isOverdue: j.status !== "completed" && checkIsOverdue(j.deadline),
              workerName: userMap[j.workerId] || "未定"
            });
          }

          if (j.workerComment && j.workerComment.trim() !== "") {
            const comDate = j.updatedAt?.toDate ? j.updatedAt.toDate() : (j.updatedAt ? new Date(j.updatedAt) : new Date());
            commentList.push({
              id: j.id,
              title: j.title || "無題の案件",
              workerName: userMap[j.workerId] || "未定",
              comment: j.workerComment,
              status: j.status,
              timeStr: comDate.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }) + " " + comDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }),
              rawDate: comDate
            });
          }

          if (j.workerId) {
            if (!workerAgg[j.workerId]) {
              workerAgg[j.workerId] = { name: userMap[j.workerId], total: 0, working: 0, review: 0, completed: 0, totalSeconds: 0 };
            }
            const w = workerAgg[j.workerId];
            w.total++;
            w.totalSeconds += (j.totalAccumulatedSeconds || 0);

            if (j.status === "working" || j.status === "paused") { 
              w.working++; 
            } else if (j.status === "review") { 
              w.review++; 
            } else if (j.status === "completed") { 
              w.completed++; 
            }
          }
        });

        const formattedLogs = lSnap.docs.slice(0, 10).map(d => {
          const logData = d.data();
          const logDate = logData.timestamp?.toDate() ? logData.timestamp.toDate() : new Date();
          return {
            id: d.id,
            workerName: userMap[logData.workerId] || "不明のワーカー",
            jobTitle: logData.jobTitle || "無題の案件",
            seconds: logData.seconds || 0,
            timeStr: logDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
          };
        });

        commentList.sort((a: any, b: any) => b.rawDate.getTime() - a.rawDate.getTime());
        setRecentComments(commentList.slice(0, 10));

        setStats({ 
          totalJobs: allJobs.length, 
          activeJobs: active, 
          reviewJobs: review, 
          totalSeconds: totalSec,
          draftJobs: draft,
          openJobs: open,
          nearDeadlineJobs: nearDeadline,
          overdueJobs: overdue
        });
        setWorkerStats(Object.values(workerAgg).sort((a: any, b: any) => b.total - a.total));
        setRecentLogs(formattedLogs);
        setAlertJobs(alertList.slice(0, 10));

      } catch (e) { 
        console.error(e); 
      } finally { 
        setLoading(false); 
      }
    }
    if (!authLoading) fetchData();
  }, [user, authLoading]);

  if (authLoading || loading) return <OwnerShell title="集計中..."><div className="p-10 text-slate-400 text-center text-xs font-bold">リアルタイムデータを取得中...</div></OwnerShell>;

  return (
    <OwnerShell title="オーナーダッシュボード" subTitle="稼働状況一覧 ＆ 総合コントロールコンソール">
      <div className="space-y-4 max-w-full mx-auto text-slate-900 font-sans antialiased">
        
        {/* 【最上段】コントロールバー */}
        <div className="bg-white p-3 rounded border-2 border-slate-300 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-sm font-black text-slate-700 flex items-center gap-1.5 pl-1 select-none">
            <span className="inline-block w-2.5 h-2.5 bg-[#0082C8] rounded-full animate-pulse"></span>
            システムクイック操作パネル
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
            <Link href="/owner/jobs/new" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-black px-4 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap">
              📝 新規案件登録
            </Link>
            <Link href="/owner/jobs" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-black px-4 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap">
              🗂️ 案件・検収管理
            </Link>
            <Link href="/owner/exports" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-black px-4 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap">
              📊 月次データ出力
            </Link>
            <Link href="/owner/settings" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-black px-4 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap">
              ⚙️ 全体ルール設定
            </Link>
          </div>
        </div>

        {/* 【中段エリア】左右2分割 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* 左側：システム稼働状況サマリー */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[290px]">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-300 font-black text-sm text-slate-800 flex justify-between items-center select-none">
              <span>📊 システム稼働状況サマリー</span>
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">System Stats</span>
            </div>
            
            <div className="p-4.5 flex flex-col justify-between flex-1 bg-white divide-y-2 divide-slate-100">
              <div className="grid grid-cols-3 gap-3 pb-4">
                <div className={`p-3 bg-white border border-slate-200 rounded flex flex-col justify-between shadow-sm ${stats.reviewJobs > 0 ? 'bg-amber-50/10 border-amber-300' : ''}`}>
                  <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">要検収</span>
                  <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">{stats.reviewJobs}<span className="text-xs font-bold text-slate-400 ml-0.5">件</span></div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded flex flex-col justify-between shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">進行中</span>
                  <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">{stats.activeJobs}<span className="text-xs font-bold text-slate-400 ml-0.5">件</span></div>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded flex flex-col justify-between bg-slate-50/40 shadow-sm">
                  <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">総稼働（累計）</span>
                  <div className="text-2xl font-black text-[#0082C8] font-mono tracking-tight truncate">{formatTime(stats.totalSeconds)}</div>
                </div>
              </div>

              <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 items-center">
                <div className="space-y-2.5 flex flex-col justify-center">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[14px] font-black text-slate-800">📋 登録総数</span>
                    <span className="text-base font-black text-slate-900 font-mono bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded shadow-sm">{stats.totalJobs} <span className="text-[10px] font-bold text-slate-400">件</span></span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-sm font-black">
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-center shadow-sm">
                      <span className="text-slate-500 font-sans font-black text-[11px] block mb-0.5">下書き</span>
                      <span className="text-slate-900 text-base font-bold">{stats.draftJobs}</span>
                    </div>
                    <div className="bg-emerald-50/40 border border-emerald-200 rounded p-2.5 text-center shadow-sm">
                      <span className="text-emerald-700 font-sans font-black text-[11px] block mb-0.5">未受諾</span>
                      <span className="text-emerald-900 text-base font-bold">{stats.openJobs}</span>
                    </div>
                  </div>
                </div>

                <div className="sm:border-l border-slate-200 sm:pl-4 space-y-2.5 flex flex-col justify-center">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[14px] font-black text-slate-800">⏱️ 期日アラート</span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Alert</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 font-mono text-sm font-black">
                    <div className={`border rounded p-2.5 text-center shadow-sm flex flex-col justify-between min-h-[64px] ${stats.nearDeadlineJobs > 0 ? 'bg-amber-50/60 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                      <span className="text-slate-500 font-sans font-black text-[11px] block mb-1 whitespace-nowrap">1週間以内</span>
                      <span className="text-base font-bold text-slate-900">{stats.nearDeadlineJobs}</span>
                    </div>
                    <div className={`border rounded p-2.5 text-center shadow-sm flex flex-col justify-between min-h-[64px] ${stats.overdueJobs > 0 ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                      <span className="text-rose-600 font-sans font-black text-[11px] block mb-1 whitespace-nowrap">期限超過</span>
                      <span className="text-base font-bold text-rose-900">{stats.overdueJobs}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：ワーカー別リアルタイム稼働明細 */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[290px]">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-300 flex justify-between items-center select-none">
              <span className="text-sm font-black text-slate-800">👤 リアルタイムワーカー稼働明細</span>
              <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Worker List</span>
            </div>

            <div className="divide-y divide-slate-200 overflow-y-auto flex-1 bg-white max-h-[230px]">
              {workerStats.map((ws, i) => (
                <div key={i} className="p-3 hover:bg-slate-50 flex items-center justify-between transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-slate-950 truncate">{ws.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 font-bold">総請負: {ws.total}件 (完了: {ws.completed}件)</div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-4">
                    <div className="text-xs text-slate-600 font-bold flex gap-2">
                      {ws.working > 0 && <span className="text-blue-600 bg-blue-50 px-1 rounded">進行:{ws.working}</span>}
                      {ws.review > 0 && <span className="text-amber-600 font-black bg-amber-50 px-1.5 rounded border border-amber-200">要検収:{ws.review}</span>}
                    </div>
                    <div className="text-sm font-black text-[#0082C8] font-mono bg-slate-50 px-2.5 py-1 rounded border border-slate-200 w-20 text-center shadow-sm">
                      {formatTime(ws.totalSeconds)}
                    </div>
                  </div>
                </div>
              ))}
              {workerStats.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic font-medium text-xs">現在、稼働データはありません</div>
              )}
            </div>
          </div>

        </div>

        {/* 【下段エリア】左右2分割 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* 左パネル：ワーカー各自の直近の行動タイムライン */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[450px]">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-300 font-black text-sm text-slate-800 flex justify-between items-center select-none">
              <span>🔔 ワーカー新着行動タイムライン（直近の打刻ログ：最大10件）</span>
              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Activity Logs</span>
            </div>
            <div className="divide-y divide-slate-100 bg-white overflow-y-auto flex-1">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-3 flex items-center justify-between text-slate-800 hover:bg-slate-50/40 transition-colors border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-bold text-slate-900 text-sm">
                      👤 <span className="text-slate-950 font-black">{log.workerName}</span> が実績を記録
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-1 font-medium">案件: {log.jobTitle}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="bg-blue-50 text-[#0082C8] border border-blue-200 px-2 py-0.5 font-mono font-black rounded text-xs shadow-sm">
                      +{formatTextTime(log.seconds)}
                    </span>
                    <span className="block text-[10px] text-slate-400 font-mono mt-1 font-bold">{log.timeStr}</span>
                  </div>
                </div>
              ))}
              {recentLogs.length === 0 && (
                <div className="p-16 text-center text-slate-400 italic font-medium text-xs">現在、新着の打刻アクションはありません</div>
              )}
            </div>
          </div>

          {/* 右パネル：要対応・至急案件アラートダイジェスト */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[450px]">
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-300 font-black text-sm text-slate-800 flex justify-between items-center select-none">
              <span>⚠️ 要検収 ＆ 至急案件・期限超過ダイジェスト（最大10件）</span>
              <span className="text-[9px] font-mono text-rose-500 font-bold uppercase">Alert Desk</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white overflow-y-auto flex-1">
              {alertJobs.map((job) => (
                <div key={job.id} className="p-3 flex items-center justify-between text-slate-800 hover:bg-slate-50/40 transition-colors border-b border-slate-100 last:border-0">
                  <div className="min-w-0 flex-1 pr-3">
                    <Link href={`/owner/jobs`} className="font-black text-slate-950 hover:text-[#0082C8] hover:underline block truncate text-sm">
                      {job.title}
                    </Link>
                    <p className="text-xs text-slate-500 mt-1 font-bold">担当ワーカー: {job.workerName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {job.isOverdue && (
                      <span className="bg-rose-100 text-rose-700 border border-rose-300 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide">期限超過</span>
                    )}
                    {job.urgency === "3" && !job.isOverdue && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black px-2 py-0.5 rounded uppercase animate-pulse">至急</span>
                    )}
                    {job.status === "review" && (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black px-2 py-0.5 rounded">要検収</span>
                    )}
                    {job.status !== "review" && !job.isOverdue && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black px-2 py-0.5 rounded">進行中</span>
                    )}
                  </div>
                </div>
              ))}
              {alertJobs.length === 0 && (
                <div className="p-16 text-center text-slate-400 italic font-medium text-xs">現在、検収待ちや至急対応 of 案件はありません。順調です！</div>
              )}
            </div>
          </div>

        </div>

        {/* 💬 ワーカーリアルタイム報告・作業メモフィード */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[400px]">
          <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-300 font-black text-sm text-slate-800 flex justify-between items-center select-none">
            <span>💬 ワーカーリアルタイム報告・作業メモフィード（新着順：最大10件）</span>
            <span className="text-[9px] font-mono text-[#0082C8] font-bold uppercase">Worker Comments</span>
          </div>
          <div className="divide-y divide-slate-100 bg-white overflow-y-auto flex-1">
            {recentComments.map((com) => (
              <div key={com.id} className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-slate-800 hover:bg-slate-50/40 transition-colors border-b border-slate-100 last:border-0">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-slate-950 text-sm">#️⃣ {com.workerName}</span>
                    <span className="text-[10px] text-slate-300 font-bold">➔</span>
                    <Link 
                      href={`/owner/jobs/${com.id}`} 
                      className="font-black text-xs text-[#0082C8] hover:underline hover:text-[#0072B5] transition-colors truncate max-w-xs sm:max-w-md block"
                    >
                      {com.title}
                    </Link>
                    <span className={`px-2 py-0.5 border text-[9px] font-black rounded block text-center uppercase tracking-wide ${
                      com.status === 'working' ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' :
                      com.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      com.status === 'review' ? 'bg-orange-50 text-orange-700 border-orange-200 font-extrabold' :
                      com.status === 'completed' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {com.status === 'working' ? '進行中' : 
                       com.status === 'paused' ? '一時停止' : 
                       com.status === 'review' ? '検収待ち' : 
                       com.status === 'completed' ? '完了' : '受諾済'}
                    </span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed shadow-inner">
                    {com.comment}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 self-end sm:self-start">
                  <span className="text-[10px] text-slate-400 font-mono font-bold block">{com.timeStr}</span>
                </div>
              </div>
            ))}
            {recentComments.length === 0 && (
              <div className="p-16 text-center text-slate-400 italic font-medium text-xs">現在、ワーカーからのテキスト報告（一時保存・完了メモ）はありません。</div>
            )}
          </div>
        </div>

      </div>
    </OwnerShell> // 💡 完璧に OwnerShell で閉じる形に大修正！
  );
}