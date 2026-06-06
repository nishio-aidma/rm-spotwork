"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, where, doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [viewDate, setViewDate] = useState(new Date()); 
  const [stats, setStats] = useState({ totalJobs: 0, activeJobs: 0, reviewJobs: 0, totalSeconds: 0 });
  const [workerStats, setWorkerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      setLoading(true);
      try {
        const jSnap = await getDocs(query(collection(db, "jobs"), orderBy("createdAt", "desc")));
        const allJobs = jSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const uSnap = await getDocs(query(collection(db, "users"), where("role", "==", "worker")));
        const userMap: any = {};
        uSnap.docs.forEach(d => {
          const u = d.data();
          userMap[d.id] = `${u.lastName || ""} ${u.firstName || ""}`.trim() || u.name || "不明";
        });

        let totalSec = 0, active = 0, review = 0;
        const workerAgg: any = {};

        allJobs.forEach((j: any) => {
          if (j.status === "working" || j.status === "paused") active++;
          if (j.status === "review") review++;
          
          // 💡【大改造】「総稼働時間」は、未受諾(open)・下書き(draft)以外の「ワーカーが少しでも稼働した秒数」をすべて漏れなく合算！
          if (j.status !== "open" && j.status !== "draft") {
            totalSec += (j.totalAccumulatedSeconds || 0);
          }

          if (j.workerId) {
            if (!workerAgg[j.workerId]) {
              // 💡構造整理: 各ワーカーの秒数集計用の入れ物（totalSeconds）を用意
              workerAgg[j.workerId] = { name: userMap[j.workerId], total: 0, working: 0, review: 0, completed: 0, totalSeconds: 0 };
            }
            const w = workerAgg[j.workerId];
            w.total++;
            
            // 該当ワーカーの全ステータスの稼働秒数をここにシンプルに足し算していきます
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

        setStats({ totalJobs: allJobs.length, activeJobs: active, reviewJobs: review, totalSeconds: totalSec });
        setWorkerStats(Object.values(workerAgg).sort((a: any, b: any) => b.total - a.total));
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
    <OwnerShell title="メインメニュー" subTitle="稼働状況一覧">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-full mx-auto">
        
        {/* 【左側エリア：コラム7】ステータスカード ＆ 特大操作アクションボタン */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* 指標カード：パキッとしたグリッド配置 */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`p-3 bg-white border-2 rounded ${stats.reviewJobs > 0 ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300'}`}>
              <span className="text-[10px] font-black text-slate-400 block uppercase">要検収</span>
              <div className="text-xl font-black text-slate-900 mt-1">{stats.reviewJobs}<span className="text-xs font-normal text-slate-500 ml-0.5">件</span></div>
            </div>
            <div className="p-3 bg-white border-2 border-slate-300 rounded">
              <span className="text-[10px] font-black text-slate-400 block uppercase">進行中</span>
              <div className="text-xl font-black text-slate-900 mt-1">{stats.activeJobs}<span className="text-xs font-normal text-slate-500 ml-0.5">件</span></div>
            </div>
            {/* 💡指標タイトルの文字を、実態に合わせて「総稼働（累計）」へスリム化 */}
            <div className="p-3 bg-white border-2 border-slate-300 rounded">
              <span className="text-[10px] font-black text-slate-400 block uppercase">総稼働（累計）</span>
              <div className="text-sm font-black text-[#0082C8] mt-2 truncate font-mono">{formatTime(stats.totalSeconds)}</div>
            </div>
          </div>

          {/* クイックアクション：超特大の操作ボタン */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/owner/jobs/new" className="flex flex-col items-center justify-center p-8 bg-[#0082C8] hover:bg-[#0072B5] text-white border border-black/10 rounded shadow-sm transition-all group text-center">
              <span className="text-3xl mb-2">📝</span>
              <span className="text-sm font-black tracking-wider">新規案件を登録する</span>
              <span className="text-[10px] text-white/70 mt-1 font-medium">新しく発注データを作成します</span>
            </Link>

            <Link href="/owner/jobs" className="flex flex-col items-center justify-center p-8 bg-emerald-600 hover:bg-emerald-700 text-white border border-black/10 rounded shadow-sm transition-all group text-center">
              <span className="text-3xl mb-2">🗂️</span>
              <span className="text-sm font-black tracking-wider">案件一覧・検収管理</span>
              <span className="text-[10px] text-white/70 mt-1 font-medium">ステータス変更・承認画面へ</span>
            </Link>
          </div>
        </div>

        {/* 【右側エリア：コラム5】ワーカー別稼働状況（レジの明細・レシート風の高密度リスト） */}
        <div className="lg:col-span-5">
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm flex flex-col h-full">
            {/* 明細ヘッダー */}
            <div className="bg-slate-100 p-3 border-b border-slate-300 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700">リアルタイム稼働明細</span>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">COUNT: {workerStats.length}</span>
            </div>

            {/* 明細行スタック */}
            <div className="divide-y divide-slate-200 overflow-y-auto max-h-[340px]">
              {workerStats.map((ws, i) => (
                <div key={i} className="p-3 hover:bg-slate-50 flex items-center justify-between text-xs transition-colors">
                  <div>
                    <div className="font-black text-slate-900">{ws.name}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">総請負: {ws.total}件 (完了: {ws.completed}件)</div>
                  </div>
                  <div className="text-right space-y-1 font-medium">
                    {/* 💡【新表示】そのワーカーがこれまでに刻んだ「すべての合計稼働時間」をスッキリ美しく表示！ */}
                    <div className="text-slate-900 font-black font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-right">
                      ⏱️ {formatTime(ws.totalSeconds)}
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold flex gap-2 justify-end">
                      {ws.working > 0 && <span className="text-blue-600">進行: {ws.working}件</span>}
                      {ws.review > 0 && <span className="text-rose-600 font-black bg-rose-50 px-1 rounded">要検収: {ws.review}件</span>}
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

      </div>
    </OwnerShell>
  );
}