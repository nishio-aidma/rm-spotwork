"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import { useParams, useRouter } from "next/navigation";

export default function WorkerDetailPage() {
  const { user: owner, loading: authLoading } = useRequireAuth("owner");
  const { id } = useParams();
  const router = useRouter();
  
  const [worker, setWorker] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalSeconds: 0, completedCount: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkerDetail() {
      if (!id || !owner) return;
      try {
        // 1. 基本情報の取得
        const wSnap = await getDoc(doc(db, "users", id as string));
        if (!wSnap.exists()) return;
        setWorker(wSnap.data());

        // 2. 統計の取得
        const [logSnap, jobSnap] = await Promise.all([
          getDocs(query(collection(db, "workLogs"), where("workerId", "==", id))),
          getDocs(query(collection(db, "jobs"), where("workerId", "==", id), where("status", "==", "completed")))
        ]);

        let totalSec = 0;
        logSnap.docs.forEach(d => totalSec += (d.data().seconds || 0));
        
        setStats({
          totalSeconds: totalSec,
          completedCount: jobSnap.size
        });

        // 3. 直近のログ5件
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

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}時間 ${m}分`;
  };

  if (authLoading || loading) return <OwnerShell title="ワーカー詳細"><div className="p-10 text-slate-400 text-center text-sm">読み込み中...</div></OwnerShell>;
  if (!worker) return <OwnerShell title="エラー"><div className="p-10 text-center">ワーカーが見つかりませんでした。</div></OwnerShell>;

  return (
    <OwnerShell title="ワーカープロファイル" subTitle={`${worker.lastName} ${worker.firstName} さんの活動詳細`}>
      <div className="max-w-4xl mx-auto space-y-8 pb-20 text-slate-800 font-sans">
        
        {/* 戻るボタン */}
        <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 transition-all uppercase tracking-widest italic">
          ← ワーカー一覧へ戻る
        </button>

        {/* 基本情報カード */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex items-center gap-8">
          <div className="w-20 h-20 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-3xl font-bold shadow-lg shadow-slate-100 uppercase">
            {worker.lastName?.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              {worker.lastName} {worker.firstName}
            </h2>
            <p className="text-sm text-slate-400 font-medium mt-1">{worker.email}</p>
            <div className="flex gap-4 mt-4">
              <div className="bg-slate-50 px-3 py-1 rounded-md text-[10px] font-bold text-slate-400 border border-slate-100">
                登録日: {worker.createdAt?.toDate().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {/* 統計ボックス */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">総稼働時間</span>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{formatTime(stats.totalSeconds)}</span>
          </div>
          <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">完了案件数</span>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{stats.completedCount} <span className="text-sm font-medium text-slate-400">件</span></span>
          </div>
        </div>

        {/* 直近の稼働履歴 */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">直近の活動履歴</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {logs.length > 0 ? logs.map(log => (
              <div key={log.id} className="px-6 py-5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                <div>
                  <div className="text-[12px] font-bold text-slate-700">{log.jobTitle}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{log.timestamp?.toDate().toLocaleString()}</div>
                </div>
                <div className="text-[11px] font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg font-mono">
                  {Math.floor(log.seconds / 60)}m {log.seconds % 60}s
                </div>
              </div>
            )) : (
              <div className="p-16 text-center text-slate-300 italic text-sm">稼働履歴はまだありません</div>
            )}
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}