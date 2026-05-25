"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import WorkerShell from "@/components/WorkerShell";
import { useRouter } from "next/navigation";

export default function WorkerJobsPage() {
  const { user, loading: authLoading } = useRequireAuth("worker");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchJobs() {
      if (!user) return;
      try {
        const q = query(collection(db, "jobs"), where("status", "==", "open"));
        const snap = await getDocs(q);
        
        // データの取得と並び替え（緊急度順 ＆ 期日順）
        const rawJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const sorted = rawJobs.sort((a, b) => {
          const urgencyA = Number(a.urgency) || 1;
          const urgencyB = Number(b.urgency) || 1;
          // 1. 緊急度が高い(3)順
          if (urgencyB !== urgencyA) return urgencyB - urgencyA;
          // 2. 同じなら期日が近い順
          const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
          const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
          return dateA - dateB;
        });
        
        setJobs(sorted);
      } catch (error) { 
        console.error(error); 
      } finally { 
        setLoading(false); 
      }
    }
    if (!authLoading) fetchJobs();
  }, [user, authLoading]);

  if (authLoading || loading) return <WorkerShell title="Jobs"><div className="p-10 italic text-center">Loading...</div></WorkerShell>;

  return (
    <WorkerShell title="Job Marketplace" subTitle="案件を探す">
      <div className="space-y-4 pb-20 font-sans">
        {/* 戻るボタン */}
        <button onClick={() => router.push("/worker/dashboard")} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-all">
          ← DASHBOARD
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.length > 0 ? jobs.map((job) => (
            <Link key={job.id} href={`/worker/jobs/${job.id}`} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">募集中</span>
                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                  {job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}
                </span>
              </div>

              <h3 className="mt-3 text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors leading-tight min-h-[40px]">
                {job.title}
              </h3>

              {/* 緊急度バッジと期限の表示 */}
              <div className="mt-2 flex flex-wrap gap-2">
                {job.urgency === "3" && (
                  <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm">至急</span>
                )}
                {job.urgency === "2" && (
                  <span className="bg-orange-400 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-sm">優先</span>
                )}
                <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                  📅 期限: {job.deadline || "なし"}
                </span>
              </div>
              
              <div className="mt-6 flex items-center justify-between border-t border-slate-50 pt-4">
                <div className="text-[10px] font-bold text-slate-400">
                  予定件数: <span className="text-slate-800 font-mono">{job.count || job.createCount || "-"}</span> 件
                </div>
                <div className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                  詳細を見る →
                </div>
              </div>
            </Link>
          )) : (
            <div className="col-span-full py-20 text-center">
              <p className="text-xs text-slate-300 italic">現在募集中の案件はありません</p>
            </div>
          )}
        </div>
      </div>
    </WorkerShell>
  );
}