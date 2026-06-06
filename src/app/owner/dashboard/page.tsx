"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [stats, setStats] = useState({ totalJobs: 0, activeJobs: 0, reviewJobs: 0, totalSeconds: 0 });
  const [workerStats, setWorkerStats] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]); // 新着アクティビティ用
  const [alertJobs, setAlertJobs] = useState<any[]>([]); // 要対応・至急案件の抜粋用
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
    return `${h > 0 ? h + '時間' : ''}${m}分${sec}秒`;
  };

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        // 1. 各種データの取得 (jobs, users, workLogs)
        const [jSnap, uSnap, lSnap] = await Promise.all([
          getDocs(query(collection(db, "jobs"), orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "users"), where("role", "==", "worker"))),
          getDocs(query(collection(db, "workLogs"), orderBy("timestamp", "desc")))
        ]);

        const allJobs = jSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // ワーカーID ➔ 名前変換マップ
        const userMap: any = {};
        uSnap.docs.forEach(d => {
          const u = d.data();
          userMap[d.id] = `${u.lastName || ""} ${u.firstName || ""}`.trim() || u.name || "不明";
        });

        // 2. 基本ステータス・ワーカー統計の集計
        let totalSec = 0, active = 0, review = 0;
        const workerAgg: any = {};
        const alertList: any[] = [];

        allJobs.forEach((j: any) => {
          if (j.status === "working" || j.status === "paused") active++;
          if (j.status === "review") review++;
          
          if (j.status !== "open" && j.status !== "draft") {
            totalSec += (j.totalAccumulatedSeconds || 0);
          }

          // 【抜粋情報用】「検収待ち」または「至急(urgency === '3')」の案件をリスト化
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

        // 3. 新着アクティビティログの整形 (直近5件)
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

        setStats({ totalJobs: allJobs.length, activeJobs: active, reviewJobs: review, totalSeconds: totalSec });
        setWorkerStats(Object.values(workerAgg).sort((a: any, b: any) => b.total - a.total));
        setRecentLogs(formattedLogs);
        setAlertJobs(alertList.slice(0, 5)); // 要対応案件は最大5件抜粋

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
        
        {/* === 上段エリア：サマリーカード ＆ 右側リアルタイム明細（左右2分割Grid） === */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* 左コラム：3連メトリクスカード */}
          <div className="lg:col-span-7 grid grid-cols-3 gap-2">
            <div className={`p-4 bg-white border-2 rounded shadow-sm ${stats.reviewJobs > 0 ? 'border-amber-400 bg-amber-50/20' : 'border-slate-300'}`}>
              <span className="text-[10px] font-black text-slate-400 block uppercase">要検収</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats.reviewJobs}<span className="text-xs font-normal text-slate-500 ml-0.5">件</span></div>
            </div>
            <div className="p-4 bg-white border-2 border-slate-300 rounded shadow-sm">
              <span className="text-[10px] font-black text-slate-400 block uppercase">進行中</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{stats.activeJobs}<span className="text-xs font-normal text-slate-500 ml-0.5">件</span></div>
            </div>
            <div className="p-4 bg-white border-2 border-slate-300 rounded shadow-sm">
              <span className="text-[10px] font-black text-slate-400 block uppercase">総稼働（累計）</span>
              <div className="text-base font-black text-[#0082C8] mt-2.5 truncate font-mono">{formatTime(stats.totalSeconds)}</div>
            </div>
          </div>

          {/* 右コラム：ワーカー別リアルタイム稼働明細 */}
          <div className="lg:col-span-5 lg:row-span-2">
            <div className="bg-white border-2 border-slate-300 rounded shadow-sm flex flex-col h-full">
              <div className="bg-slate-100 p-3 border-b border-slate-300 flex justify-between items-center">
                <span className="text-xs font-black text-slate-700">👤 リアルタイムワーカー稼働明細</span>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">COUNT: {workerStats.length}</span>
              </div>

              <div className="divide-y divide-slate-200 overflow-y-auto max-h-[260px] flex-1">
                {workerStats.map((ws, i) => (
                  <div key={i} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors">
                    <div>
                      <div className="font-black text-slate-900">{ws.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">総請負: {ws.total}件 (完了: {ws.completed}件)</div>
                    </div>
                    <div className="text-right space-y-1 font-medium">
                      <div className="text-slate-900 font-black font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block text-right">
                        ⏱️ {formatTime(ws.totalSeconds)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold flex gap-2 justify-end">
                        {ws.working > 0 && <span className="text-blue-600">進行: {ws.working}件</span>}
                        {ws.review > 0 && <span className="text-amber-600 font-black bg-amber-50 px-1 rounded">要検収: {ws.review}件</span>}
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

          {/* === 中段エリア：【監督発案】4連のおしゃれなマルチショートカット・タイル・コンソール === */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link href="/owner/jobs/new" className="flex flex-col items-center justify-center p-5 bg-white hover:bg-blue-50/30 border-2 border-slate-300 rounded shadow-sm transition-all group text-center active:scale-95">
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📝</span>
              <span className="text-xs font-black text-slate-800">新規案件登録</span>
              <span className="text-[9px] text-slate-400 mt-0.5 font-medium leading-tight">発注データを作成</span>
            </Link>

            <Link href="/owner/jobs" className="flex flex-col items-center justify-center p-5 bg-white hover:bg-emerald-50/30 border-2 border-slate-300 rounded shadow-sm transition-all group text-center active:scale-95">
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🗂️</span>
              <span className="text-xs font-black text-slate-800">案件・検収管理</span>
              <span className="text-[9px] text-slate-400 mt-0.5 font-medium leading-tight">承認・ステータス変更</span>
            </Link>

            <Link href="/owner/exports" className="flex flex-col items-center justify-center p-5 bg-white hover:bg-cyan-50/30 border-2 border-slate-300 rounded shadow-sm transition-all group text-center active:scale-95">
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📊</span>
              <span className="text-xs font-black text-slate-800">月次データ出力</span>
              <span className="text-[9px] text-slate-400 mt-0.5 font-medium leading-tight">実績確認とCSV抽出</span>
            </Link>

            <Link href="/owner/settings" className="flex flex-col items-center justify-center p-5 bg-white hover:bg-purple-50/30 border-2 border-slate-300 rounded shadow-sm transition-all group text-center active:scale-95">
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">⚙️</span>
              <span className="text-xs font-black text-slate-800">システム設定</span>
              <span className="text-[9px] text-slate-400 mt-0.5 font-medium leading-tight">全体ルールの管理</span>
            </Link>
          </div>

        </div>

        {/* === 下段エリア：【監督発案】余白を埋める2大インフォメーション・ダイジェストパネル === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          
          {/* 左パネル：ワーカー各自の直近の行動タイムライン（新着5件） */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-3 py-2.5 border-b border-slate-300 font-black text-xs text-slate-700 flex justify-between items-center">
              <span>🔔 ワーカー新着行動タイムライン（直近の打刻ログ）</span>
              <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">Activity Logs</span>
            </div>
            <div className="divide-y divide-slate-100 bg-white flex-1">
              {recentLogs.map((log) => (
                <div key={log.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/40 transition-colors">
                  <div className="min-w-0 flex-1 pr-3">
                    <p className="font-bold text-slate-800">
                      👤 <span className="text-slate-950 font-black">{log.workerName}</span> が稼働実績を記録
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
                <div className="p-8 text-center text-slate-400 italic font-medium">現在、新着の打刻アクションはありません</div>
              )}
            </div>
          </div>

          {/* 右パネル：要対応・至急案件アラートダイジェスト（最大5件） */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-3 py-2.5 border-b border-slate-300 font-black text-xs text-slate-700 flex justify-between items-center">
              <span>⚠️ 要検収 ＆ 至急案件ダイジェスト（オーナー即時チェック推奨）</span>
              <span className="text-[9px] font-mono text-rose-500 font-bold uppercase">Alert Desk</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white flex-1">
              {alertJobs.map((job) => (
                <div key={job.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/40 transition-colors">
                  <div className="min-w-0 flex-1 pr-2">
                    <Link href={`/owner/jobs`} className="font-black text-slate-900 hover:text-[#0082C8] hover:underline block truncate">
                      {job.title}
                    </Link>
                    <p className="text-[10px] text-slate-400 mt-0.5">担当者: {job.workerName}</p>
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
                <div className="p-8 text-center text-slate-400 italic font-medium">現在、検収待ちや至急対応の案件はありません。順調です！</div>
              )}
            </div>
          </div>

        </div>

      </div>
    </OwnerShell>
  );
}