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

      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (!authLoading) fetchWorkerDetail();
  }, [id, owner, authLoading]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (authLoading || loading) return <OwnerShell title="Worker Detail">Loading...</OwnerShell>;
  if (!worker) return <OwnerShell title="Error">Worker not found.</OwnerShell>;

  return (
    <OwnerShell title="Worker Profile" subTitle={`${worker.lastName} ${worker.firstName} さんの詳細`}>
      <div className="max-w-4xl mx-auto space-y-6 pb-20 font-sans">
        
        <button onClick={() => router.back()} className="text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-all">← BACK TO LIST</button>

        {/* 基本情報カード */}
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm flex items-center gap-8">
          <div className="w-20 h-20 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-3xl font-black shadow-lg shadow-indigo-100">
            {worker.lastName?.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-black text-slate-800">{worker.lastName} {worker.firstName}</h2>
            <p className="text-xs text-slate-400 font-mono mt-1">{worker.email}</p>
            <div className="flex gap-4 mt-4">
              <div className="bg-slate-50 px-3 py-1 rounded-md text-[10px] font-bold text-slate-500">登録日: {worker.createdAt?.toDate().toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        {/* 統計ボックス */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Total Work Time</span>
            <span className="text-2xl font-black text-indigo-700">{formatTime(stats.totalSeconds)}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block mb-1">Completed Jobs</span>
            <span className="text-2xl font-black text-emerald-700">{stats.completedCount} <span className="text-sm">件</span></span>
          </div>
        </div>

        {/* 直近の稼働履歴 */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Activities / 直近の稼働</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {logs.length > 0 ? logs.map(log => (
              <div key={log.id} className="px-6 py-4 flex justify-between items-center">
                <div>
                  <div className="text-[11px] font-bold text-slate-700">{log.jobTitle}</div>
                  <div className="text-[9px] text-slate-400 font-mono">{log.timestamp?.toDate().toLocaleString()}</div>
                </div>
                <div className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg">
                  {Math.floor(log.seconds / 60)}m {log.seconds % 60}s
                </div>
              </div>
            )) : (
              <div className="p-10 text-center text-slate-300 italic text-xs">稼働履歴がありません</div>
            )}
          </div>
        </div>
      </div>
    </OwnerShell>
  );
}