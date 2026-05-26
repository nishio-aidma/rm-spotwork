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
        // ステータスが "open"（募集中）の案件のみ取得
        const q = query(collection(db, "jobs"), where("status", "==", "open"));
        const snap = await getDocs(q);
        
        const rawJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // 並び替え（緊急度順 ＆ 期日順）
        const sorted = rawJobs.sort((a, b) => {
          const urgencyA = Number(a.urgency) || 1;
          const urgencyB = Number(b.urgency) || 1;
          if (urgencyB !== urgencyA) return urgencyB - urgencyA;
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

  if (authLoading || loading) return <WorkerShell title="案件を探す"><div className="p-10 text-slate-400 text-center text-sm">読み込み中...</div></WorkerShell>;

  return (
    <WorkerShell title="案件を探す" subTitle="募集中の案件一覧">
      <div className="space-y-6 pb-20 text-slate-800">
        {/* 戻るボタン */}
        <button onClick={() => router.push("/worker/dashboard")} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 flex items-center gap-1 transition-all uppercase tracking-widest">
          ← ダッシュボードへ戻る
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {jobs.length > 0 ? jobs.map((job) => (
            <Link key={job.id} href={`/worker/jobs/${job.id}`} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">募集中</span>
                <span className="text-[10px] font-bold text-slate-400">
                  {job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors leading-snug min-h-[40px]">
                {job.title}
              </h3>

              <div className="mt-4 flex flex-wrap gap-2">
                {job.urgency === "3" && (
                  <span className="bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded">至急</span>
                )}
                {job.urgency === "2" && (
                  <span className="bg-amber-500 text-white text-[9px] font-bold px-2 py-0.5 rounded">優先</span>
                )}
                <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                  📅 期限: {job.deadline || "なし"}
                </span>
              </div>
              
              <div className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between">
                <div className="flex gap-4">
                  <div className="text-[10px] font-bold text-slate-400">
                    作業数: <span className="text-slate-800 font-mono">{job.count || "-"}</span>
                  </div>
                  {/* ★ 募集人数（workerLimit）を追加 */}
                  <div className="text-[10px] font-bold text-slate-400">
                    募集: <span className="text-slate-800 font-mono">{job.workerLimit || 1}</span>名
                  </div>
                </div>
                <div className="text-[10px] font-bold text-indigo-600 underline underline-offset-4 decoration-indigo-200">
                  詳細を見る ≫
                </div>
              </div>
            </Link>
          )) : (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-sm text-slate-300 font-medium">現在募集中の案件はありません</p>
            </div>
          )}
        </div>
      </div>
    </WorkerShell>
  );
}