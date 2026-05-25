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
        // 【事実に基づく修正】
        // ダッシュボードと同じく、workerIdで自分の案件をすべて取得します
        const q = query(collection(db, "jobs"), where("workerId", "==", user.uid));
        const snap = await getDocs(q);
        const myJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // ダッシュボードの集計ロジック(j.status === "working" || j.status === "review"等)に合わせ、
        // 「完了(completed)」以外の進行中のものを抽出します
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

  return (
    <WorkerShell title="進行中のタスク" subTitle="案件管理">
      <div className="space-y-4">
        {loading ? (
          <div className="p-10 text-center text-slate-400 italic">読み込み中...</div>
        ) : ongoingJobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {ongoingJobs.map((job) => (
              <Link key={job.id} href={`/worker/jobs/${job.id}`} className="bg-white border border-slate-200 p-5 rounded-xl flex justify-between items-center shadow-sm hover:border-indigo-300 transition-all group">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${
                      job.status === 'review' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                    }`}>
                      {job.status === 'review' ? '検収待ち' : '進行中'}
                    </span>
                    <h3 className="text-[12px] font-bold text-slate-700">{job.title}</h3>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">報酬: ￥{job.reward?.toLocaleString()} / 種別: {job.jobType === 'form_posting' ? 'フォーム投稿' : 'リスト作成'}</p>
                </div>
                <span className="text-slate-300 group-hover:text-indigo-500 transition-all">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-20 text-center border-2 border-dashed border-slate-100 rounded-3xl">
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest italic">現在進行中のタスクはありません</p>
            <Link href="/worker/jobs" className="text-[10px] font-bold text-indigo-500 mt-4 block underline">案件を探しに行く</Link>
          </div>
        )}
      </div>
    </WorkerShell>
  );
}