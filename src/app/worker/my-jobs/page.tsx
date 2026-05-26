"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import WorkerShell from "@/components/WorkerShell";
import Link from "next/link";

export default function OngoingTasksPage() {
  const [ongoingJobs, setOngoingJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // workerIdで自分の案件をすべて取得
        const q = query(collection(db, "jobs"), where("workerId", "==", user.uid));
        const snap = await getDocs(q);
        const myJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 「完了(completed)」以外の進行中のものを抽出
        const filtered = myJobs.filter((j: any) => 
          j.status === "working" || 
          j.status === "review" || 
          j.status === "paused" || 
          j.status === "assigned"
        );

        setOngoingJobs(filtered);
      } catch (e) {
        console.error("一覧取得エラー:", e);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // 時間フォーマット関数
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <WorkerShell title="マイタスク" subTitle="進行中の業務管理">
      <div className="max-w-5xl mx-auto space-y-6 pb-20 text-slate-800 font-sans">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            進行中の案件 ({ongoingJobs.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-20 text-center text-slate-400 text-sm">読み込み中...</div>
        ) : ongoingJobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {ongoingJobs.map((job) => (
              <Link 
                key={job.id} 
                href={`/worker/jobs/${job.id}`} 
                className="bg-white border border-slate-200 p-6 rounded-2xl flex justify-between items-center shadow-sm hover:shadow-md hover:border-slate-300 transition-all group"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
                      job.status === 'working' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                      job.status === 'review' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      job.status === 'paused' ? 'bg-slate-50 text-slate-400 border-slate-200' :
                      'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      {job.status === 'working' ? '進行中' : 
                       job.status === 'review' ? '検収待ち' : 
                       job.status === 'paused' ? '一時停止' : '請負済'}
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {job.title}
                    </h3>
                  </div>
                  
                  <div className="flex gap-6 items-center">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                      報酬: <span className="text-slate-600">￥{job.reward?.toLocaleString()}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                      種別: <span className="text-slate-600">{job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                      現在の稼働時間: <span className="text-indigo-600 font-mono">{formatTime(job.totalAccumulatedSeconds || 0)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-slate-900 transition-all uppercase tracking-tighter">
                    詳細を開く ≫
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
            <p className="text-sm text-slate-300 font-medium italic">現在進行中のタスクはありません</p>
            <Link 
              href="/worker/jobs" 
              className="inline-block mt-6 px-6 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-sm"
            >
              案件を探しに行く
            </Link>
          </div>
        )}
      </div>
    </WorkerShell>
  );
}