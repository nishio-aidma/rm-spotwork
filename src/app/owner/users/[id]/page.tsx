"use client";

import { useEffect, useState, use } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import { useRouter } from "next/navigation";

interface WorkerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkerDetailPage({ params }: WorkerDetailPageProps) {
  const { user: owner, loading: authLoading } = useRequireAuth("owner");
  const { id } = use(params);
  const router = useRouter();
  
  const [worker, setWorker] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalSeconds: 0, completedCount: 0, avgRating: "-", rankBadge: "🔥 ROOKIE", rankColor: "bg-[#0082C8] text-white" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkerDetail() {
      if (!id || !owner) return;
      try {
        // 1. 基本情報の取得
        const wSnap = await getDoc(doc(db, "users", id));
        if (!wSnap.exists()) return;
        setWorker(wSnap.data());

        // 2. 確定済みの累計稼働時間を算出（workerMonthlyStatusから）
        const monthlySnap = await getDocs(query(collection(db, "workerMonthlyStatus"), where("workerId", "==", id), where("status", "==", "confirmed")));
        let totalSec = 0;
        monthlySnap.forEach(d => {
          totalSec += (d.data().totalSeconds || 0);
        });

        // 3. 完了案件数と★評価の集計（jobsコレクションから）
        const jobsSnap = await getDocs(collection(db, "jobs"));
        let completedCount = 0;
        let ratingSum = 0;
        let ratingCount = 0;

        jobsSnap.forEach(d => {
          const jData = d.data();
          if (jData.workers && jData.workers[id]) {
            const wInfo = jData.workers[id];
            
            // 実績件数の加算
            if (wInfo.completedCount) {
              completedCount += Number(wInfo.completedCount || 0);
            }
            
            // ★評価の加算
            if (wInfo.rating && Number(wInfo.rating) > 0) {
              ratingSum += Number(wInfo.rating);
              ratingCount += 1;
            }
          }
        });

        const avgRating = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : "-";

        // 4. ランク判定
        const totalHours = Math.floor(totalSec / 3600);
        let rankBadge = "🔥 ROOKIE";
        let rankColor = "bg-[#0082C8] text-white";

        if (totalHours >= 100) { rankBadge = "👑 PLATINUM"; rankColor = "bg-slate-800 text-slate-100"; }
        else if (totalHours >= 50) { rankBadge = "🥇 GOLD"; rankColor = "bg-yellow-500 text-yellow-50"; }
        else if (totalHours >= 30) { rankBadge = "🥈 SILVER"; rankColor = "bg-slate-400 text-white"; }
        else if (totalHours >= 10) { rankBadge = "🥉 BRONZE"; rankColor = "bg-orange-700 text-orange-50"; }

        setStats({
          totalSeconds: totalSec,
          completedCount: completedCount,
          avgRating,
          rankBadge,
          rankColor
        });

        // 5. 直近のログ5件（日々の打刻）
        const recentLogQ = query(
          collection(db, "workLogs"),
          where("workerId", "==", id),
          orderBy("timestamp", "desc"),
          limit(5)
        );
        const recentSnap = await getDocs(recentLogQ);
        setLogs(recentSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (e) { 
        console.error(e); 
      } finally { 
        setLoading(false); 
      }
    }
    if (!authLoading) fetchWorkerDetail();
  }, [id, owner, authLoading]);

  const formatHM = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (authLoading || loading) return <OwnerShell title="ワーカー詳細"><div className="p-10 text-slate-400 text-center text-sm font-bold">読み込み中...</div></OwnerShell>;
  if (!worker) return <OwnerShell title="エラー"><div className="p-10 text-center font-bold text-rose-600 text-sm">ワーカーが見つかりませんでした。</div></OwnerShell>;

  const fullName = `${worker.lastName || ""} ${worker.firstName || worker.name || "不明"}`.trim();

  return (
    <OwnerShell title="ワーカー詳細・カルテ" subTitle={`${fullName} さんの詳細活動・評価データ`}>
      <div className="max-w-4xl mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 戻るボタン */}
        <button 
          onClick={() => router.back()} 
          className="bg-white border-2 border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-black px-4 py-1.5 rounded transition-all active:scale-95 shadow-sm select-none cursor-pointer"
        >
          🔙 ワーカー一覧へ戻る
        </button>

        {/* 基本情報カード */}
        <div className="bg-white border-2 border-slate-300 rounded p-6 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6 relative">
          <div className="w-20 h-20 bg-slate-100 border-2 border-slate-300 text-slate-400 rounded flex items-center justify-center text-3xl font-black shadow-inner shrink-0 select-none">
            👤
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-slate-950 tracking-tight leading-none">
                {fullName}
              </h2>
              <span className={`px-2 py-0.5 text-[10px] font-black rounded shadow-2xs select-none ${stats.rankColor}`}>
                {stats.rankBadge}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono font-bold">{worker.email}</p>
            <div className="pt-2">
              <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-500 border border-slate-200 select-none">
                システム登録日: {worker.createdAt?.toDate ? worker.createdAt.toDate().toLocaleDateString() : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* 自己紹介・稼働時間（ワーカー入力情報） */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
          <div className="bg-slate-100 p-3 border-b-2 border-slate-300">
            <span className="text-xs font-black text-slate-700">ワーカー登録プロフィール</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="p-4 space-y-1.5 bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">自己紹介 / 得意な業務</span>
              <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                {worker.selfIntroduction || <span className="text-slate-300 italic font-normal">未登録</span>}
              </p>
            </div>
            <div className="p-4 space-y-1.5 bg-slate-50/50">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">1週間の稼働可能時間（目安）</span>
              <p className="text-xs font-bold text-slate-800">
                {worker.availableHours || <span className="text-slate-300 italic font-normal">未登録</span>}
              </p>
            </div>
          </div>
        </div>

        {/* 統計ボックス（3軸集計） */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
          <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
            <span className="text-xs font-black text-slate-700">累計実績データ</span>
            <span className="text-[10px] font-mono font-bold text-slate-400">TOTAL STATS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-300 text-center">
            
            <div className="p-5 space-y-1 bg-blue-50/40">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">確定済みの累計稼働時間</span>
              <p className="text-2xl font-black text-[#0082C8] tracking-tight font-mono pt-1">
                {formatHM(stats.totalSeconds)}
              </p>
            </div>

            <div className="p-5 space-y-1 flex flex-col justify-center bg-white">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">累計納品件数</span>
              <p className="text-2xl font-black text-slate-900 font-mono pt-1">
                {stats.completedCount} <span className="text-[11px] font-bold text-slate-500">件</span>
              </p>
            </div>

            <div className="p-5 space-y-1 flex flex-col justify-center bg-amber-50/40">
              <span className="text-[10px] font-black text-amber-700/60 uppercase tracking-wider block">平均社内評価 (非公開)</span>
              <p className="text-2xl font-black text-amber-600 font-mono pt-1">
                {stats.avgRating !== "-" ? `⭐ ${stats.avgRating}` : "-"}
              </p>
            </div>

          </div>
        </div>

        {/* 直近の稼働履歴（打刻ログ） */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
          <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
            <span className="text-xs font-black text-slate-700">直近の打刻ログ（最新5件）</span>
            <span className="text-[10px] font-mono font-bold text-slate-400">RECENT LOGS</span>
          </div>
          <div className="divide-y-2 divide-slate-100 bg-white">
            {logs.length > 0 ? logs.map(log => (
              <div key={log.id} className="p-4 flex justify-between items-center hover:bg-slate-50 transition-colors">
                <div className="min-w-0 flex-1 pr-4">
                  <div className="text-[11px] font-black text-slate-800 truncate mb-1" title={log.jobTitle}>{log.jobTitle || "無題の案件"}</div>
                  <div className="text-[10px] text-slate-500 font-mono font-bold">{log.timestamp?.toDate().toLocaleString()}</div>
                </div>
                <div className="text-[11px] font-black text-[#0082C8] bg-blue-50 border border-blue-200 px-2 py-1 rounded font-mono shrink-0 shadow-2xs">
                  {Math.floor(log.seconds / 3600)}h {Math.floor((log.seconds % 3600) / 60)}m {log.seconds % 60}s
                </div>
              </div>
            )) : (
              <div className="p-10 text-center text-slate-400 italic text-xs font-medium">打刻ログはまだありません</div>
            )}
          </div>
        </div>

      </div>
    </OwnerShell>
  );
}