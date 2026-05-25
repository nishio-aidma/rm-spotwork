"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import WorkerShell from "@/components/WorkerShell";

export default function WorkerProfilePage() {
  const { user, loading: authLoading } = useRequireAuth("worker");
  const [stats, setStats] = useState({ totalSeconds: 0, completedCount: 0 });
  const [rankConfig, setRankConfig] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const [logSnap, jobSnap, rankSnap] = await Promise.all([
          getDocs(query(collection(db, "workLogs"), where("workerId", "==", user.uid))),
          getDocs(query(collection(db, "jobs"), where("workerId", "==", user.uid), where("status", "==", "completed"))),
          getDoc(doc(db, "settings", "rank_config"))
        ]);

        let total = 0;
        logSnap.docs.forEach(d => total += (d.data().seconds || 0));
        setStats({ totalSeconds: total, completedCount: jobSnap.size });
        if (rankSnap.exists()) setRankConfig(rankSnap.data().ranks);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (!authLoading) fetchData();
  }, [user, authLoading]);

  const currentHours = stats.totalSeconds / 3600;
  const myRank = [...rankConfig].reverse().find(r => currentHours >= r.hours) || { name: "ROOKIE" };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}時間 ${m}分`;
  };

  if (authLoading || loading) return <WorkerShell title="Profile">Loading...</WorkerShell>;

  return (
    <WorkerShell title="My Profile" subTitle="実績確認">
      <div className="max-w-3xl space-y-10 font-sans text-slate-700">
        
        {/* ヘッダー：線を細く、背景を白に */}
        <div className="border-b border-slate-200 pb-6">
          <div className="flex items-baseline gap-4">
            <h2 className="text-2xl font-medium text-slate-900">{user?.lastName} {user?.firstName}</h2>
            <span className="text-xs text-slate-400 font-medium">ランク: {myRank.name}</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">{user?.email}</p>
        </div>

        {/* スタッツ：枠を消し、シンプルな羅列に */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div>
            <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">累計稼働時間</span>
            <span className="text-xl font-medium text-slate-900">{formatTime(stats.totalSeconds)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">完了案件数</span>
            <span className="text-xl font-medium text-slate-900">{stats.completedCount} 件</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block mb-1 uppercase tracking-wider">登録日</span>
            <span className="text-xl font-medium text-slate-900">{user?.createdAt?.toDate().toLocaleDateString()}</span>
          </div>
        </div>

        {/* 進捗：バーを細く、目立たないグレーに */}
        <div className="pt-6 border-t border-slate-100">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Next Rank Progress</span>
            <span className="text-[10px] text-slate-400 italic">目標: 100時間</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full">
            <div 
              className="bg-slate-300 h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, (currentHours / 100) * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </WorkerShell>
  );
}