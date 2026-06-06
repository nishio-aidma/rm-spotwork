"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  
  // 💡 拡張版スタッツ：下書きや期日直前データもキャッチして余白を埋めます
  const [stats, setStats] = useState({ 
    totalJobs: 0, 
    activeJobs: 0, 
    reviewJobs: 0, 
    totalSeconds: 0,
    draftJobs: 0,
    openJobs: 0,
    nearDeadlineJobs: 0
  });
  
  const [workerStats, setWorkerStats] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]); 
  const [alertJobs, setAlertJobs] = useState<any[]>([]); 
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

  // 期日チェック関数
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

        let totalSec = 0, active = 0, review = 0, draft = 0, open = 0, nearDeadline = 0;
        const workerAgg: any = {};
        const alertList: any[] = [];

        allJobs.forEach((j: any) => {
          if (j.status === "working" || j.status === "paused") active++;
          if (j.status === "review") review++;
          if (j.status === "draft") draft++;
          if (j.status === "open") open++;
          
          if (j.status !== "open" && j.status !== "draft") {
            totalSec += (j.totalAccumulatedSeconds || 0);
          }

          // 期日が1週間以内の案件をカウント
          if (j.status !== "completed" && checkNearDeadline(j.deadline)) {
            nearDeadline++;
          }

          if (j.status === "review" || j.urgency === "3") {
            alertList.push({
              id: j.id,
              title: j.title || "無題の案件",
              status: j.status,
              urgency: j.urgency,
              workerName: userMap[j.workerId] || "未定"
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

        const formattedLogs = lSnap.docs.slice(0, 5).map(d => {
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

        setStats({ 
          totalJobs: allJobs.length, 
          activeJobs: active, 
          reviewJobs: review, 
          totalSeconds: totalSec,
          draftJobs: draft,
          openJobs: open,
          nearDeadlineJobs: nearDeadline
        });
        setWorkerStats(Object.values(workerAgg).sort((a: any, b: any) => b.total - a.total));
        setRecentLogs(formattedLogs);
        setAlertJobs(alertList.slice(0, 5)); 

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
    <OwnerShell title="メインメニュー" subTitle="稼働状況一覧 ＆ 総合コントロールコンソール">
      <div className="space-y-4 max-w-full mx-auto text-slate-900 font-sans antialiased">
        
        {/* 【最上段】コントロールバー */}
        <div className="bg-white border-2 border-slate-300 rounded p-3 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="text-xs font-black text-slate-700 flex items-center gap-1.5 pl-1 select-none">
            <span className="inline-block w-2 h-2 bg-[#0082C8] rounded-full animate-pulse"></span>
            システムクイック操作パネル
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full md:w-auto">
            <Link href="/owner/jobs/new" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[11px] font-black px-3 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap">
              📝 新規案件登録
            </Link>
            <Link href="/owner/jobs" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[11px] font-black px-3 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap">
              🗂️ 案件・検収管理
            </Link>
            <Link href="/owner/exports" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[11px] font-black px-3 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap">
              📊 月次データ出力
            </Link>
            <Link href="/owner/settings" className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[11px] font-black px-3 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap">
              ⚙️ 全体ルール設定
            </Link>
          </div>
        </div>

        {/* 【中段エリア】左右2分割（等幅・高さ230pxで完全固定） */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* 💡【余白撲滅リフォーム】左側：システム稼働状況サマリー（高密度インテリジェンス仕様） */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[230px]">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-300 font-black text-xs text-slate-700 flex justify-between items-center select-none">
              <span>📊 システム稼働状況サマリー</span>
              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">System Stats</span>
            </div>
            
            <div className="p-3 flex flex-col justify-between flex-1 bg-white divide-y divide-slate-100">
              {/* 上段：3連メトリクス数値をコンパクトに配置 */}
              <div className="grid grid-cols-3 gap-2 pb-3">
                <div className={`p-2 bg-white border border-slate-200 rounded flex flex-col justify-between ${stats.reviewJobs > 0 ? 'bg-amber-50/10 border-amber-300' : ''}`}>
                  <span className="text-[9px] font-black text-slate-400 block uppercase">要検収</span>
                  <div className="text-xl font-black text-slate-900 font-mono tracking-tight">{stats.reviewJobs}<span className="text-[10px] font-bold text-slate-400 ml-0.5">件</span></div>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded flex flex-col justify-between">
                  <span className="text-[9px] font-black text-slate-400 block uppercase">進行中</span>
                  <div className="text-xl font-black text-slate-900 font-mono tracking-tight">{stats.activeJobs}<span className="text-[10px] font-bold text-slate-400 ml-0.5">件</span></div>
                </div>
                <div className="p-2 bg-white border border-slate-200 rounded flex flex-col justify-between bg-slate-50/30">
                  <span className="text-[9px] font-black text-slate-400 block uppercase">総稼働（累計）</span>
                  <div className="text-xl font-black text-[#0082C8] font-mono tracking-tight truncate">{formatTime(stats.totalSeconds)}</div>
                </div>
              </div>

              {/* 💡【新設】下段：空いていた無駄スペースに全案件の内訳 ＆ アラート分析情報をギッシリ配置！ */}
              <div className="pt-3 grid grid-cols-2 gap-4 text-xs">
                {/* 内部ステータス内訳 */}
                <div className="space-y-1.5 justify-center flex flex-col">
                  <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <span>登録総数</span>
                    <span className="text-slate-700 font-mono font-bold">{stats.totalJobs} 件</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 font-mono text-[11px] font-bold">
                    <div className="bg-slate-50 border border-slate-200 rounded p-1 text-center">
                      <span className="text-slate-400 font-sans font-black text-[9px] block">下書き</span>
                      <span className="text-slate-700">{stats.draftJobs}</span>
                    </div>
                    <div className="bg-emerald-50/40 border border-emerald-200 rounded p-1 text-center">
                      <span className="text-emerald-600 font-sans font-black text-[9px] block">未受諾</span>
                      <span className="text-emerald-700">{stats.openJobs}</span>
                    </div>
                  </div>
                </div>

                {/* タイムリミットアラート */}
                <div className="border-l border-slate-200 pl-4 flex flex-col justify-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">📋 直近の期日アラート</span>
                  <div className={`p-2 border rounded text-center ${stats.nearDeadlineJobs > 0 ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <span className="text-[9px] font-black block leading-none mb-1">1週間以内の締切</span>
                    <span className="text-base font-black font-mono tracking-tight">{stats.nearDeadlineJobs} <span className="text-[10px] font-sans font-black">件</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：ワーカー別リアルタイム稼働明細 */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[230px]">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-300 flex justify-between items-center select-none">
              <span className="text-xs font-black text-slate-700">👤 リアルタイムワーカー稼働明細</span>
              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Worker List</span>
            </div>

            <div className="divide-y divide-slate-200 overflow-y-auto flex-1 bg-white">
              {workerStats.map((ws, i) => (
                <div key={i} className="p-2.5 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-slate-900 truncate">{ws.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">総: {ws.total}件 (完: {ws.completed}件)</div>
                  </div>
                  <div className="text-right flex-shrink-0 flex items-center gap-3">
                    <div className="text-[10px] text-slate-500 font-bold flex gap-2">
                      {ws.working > 0 && <span className="text-blue-600">進行:{ws.working}</span>}
                      {ws.review > 0 && <span className="text-amber-600 font-black bg-amber-50 px-1 rounded">要検収:{ws.review}</span>}
                    </div>
                    <div className="text-xs font-black text-[#0082C8] font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-16 text-center">
                      {formatTime(ws.totalSeconds)}
                    </div>
                  </div>
                </div>
              ))}
              {workerStats.length === 0 && (
                <div className="p-10 text-center text-slate-400 italic font-medium">現在、稼働データはありません</div>
              )}
            </div>
          </div>

        </div>

        {/* === 下段エリア：左右2分割タイムライン === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* 左パネル：ワーカー各自の直近の行動タイムライン */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[240px]">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-300 font-black text-xs text-slate-700 flex justify-between items-center select-none">
              <span>🔔 ワーカー新着行動タイムライン（直近の打刻ログ）</span>
              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Activity Logs</span>
            </div>
            <div className="divide-y divide-slate-100 bg-white overflow-y-auto flex-1">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/40 transition-colors">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-bold text-slate-800 text-[11px]">
                      👤 <span className="text-slate-950 font-black">{log.workerName}</span> が実績を記録
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">案件: {log.jobTitle}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="bg-blue-50 text-[#0082C8] border border-blue-200 px-1.5 py-0.5 font-mono font-bold rounded text-[10px]">
                      +{formatTextTime(log.seconds)}
                    </span>
                    <span className="block text-[9px] text-slate-400 font-mono mt-0.5">{log.timeStr}</span>
                  </div>
                </div>
              ))}
              {recentLogs.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic font-medium">現在、新着の打刻アクションはありません</div>
              )}
            </div>
          </div>

          {/* 右パネル：要対応・至急案件アラートダイジェスト */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col h-[240px]">
            <div className="bg-slate-50 px-3 py-2 border-b border-slate-300 font-black text-xs text-slate-700 flex justify-between items-center select-none">
              <span>⚠️ 要検収 ＆ 至急案件ダイジェスト（オーナー対応推奨）</span>
              <span className="text-[9px] font-mono text-rose-500 font-bold uppercase">Alert Desk</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white overflow-y-auto flex-1">
              {alertJobs.map((job) => (
                <div key={job.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/40 transition-colors">
                  <div className="min-w-0 flex-1 pr-2">
                    <Link href={`/owner/jobs`} className="font-black text-slate-900 hover:text-[#0082C8] hover:underline block truncate text-[11px]">
                      {job.title}
                    </Link>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-bold">担当: {job.workerName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {job.urgency === "3" && (
                      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse">至急</span>
                    )}
                    {job.status === "review" ? (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-1.5 py-0.5 rounded">要検収</span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-black px-1.5 py-0.5 rounded">進行中</span>
                    )}
                  </div>
                </div>
              ))}
              {alertJobs.length === 0 && (
                <div className="p-12 text-center text-slate-400 italic font-medium">現在、検収待ちや至急対応の案件はありません。順調です！</div>
              )}
            </div>
          </div>

        </div>

      </div>
    </OwnerShell>
  );
}