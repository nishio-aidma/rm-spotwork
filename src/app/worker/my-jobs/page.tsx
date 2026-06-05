"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import WorkerShell from "@/components/WorkerShell";
import Link from "next/link";

export default function WorkerMyJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyJobs = async (userId: string) => {
    setLoading(true);
    try {
      // 自分が担当（workerIdが自分の一致）している案件を全取得
      const q = query(collection(db, "jobs"), where("workerId", "==", userId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 進行中タスクとして意味のあるステータスだけを抽出し、期日が近い順に整列
      // (受諾済み、稼働中、一時停止、検収待ち)
      const myActiveJobs = list.filter((j: any) => 
        j.status === "assigned" || j.status === "working" || j.status === "paused" || j.status === "review"
      );

      // 期日（deadline）が近い順にソート（未設定は一番下に沈める安全弁付き）
      myActiveJobs.sort((a: any, b: any) => {
        const deadlineA = a.deadline && typeof a.deadline === "string" && a.deadline.trim() !== "" ? a.deadline : "9999-12-31";
        const deadlineB = b.deadline && typeof b.deadline === "string" && b.deadline.trim() !== "" ? b.deadline : "9999-12-31";
        return deadlineA.localeCompare(deadlineB);
      });

      setJobs(myActiveJobs);
    } catch (e) {
      console.error("進行中案件の取得に失敗しました:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchMyJobs(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (loading) return <WorkerShell title="進行中のタスク"><div className="p-10 text-center text-slate-400 text-xs font-bold">マイタスクを照合中...</div></WorkerShell>;

  return (
    <WorkerShell title="進行中のタスク" subTitle="あなたが受諾し、現在稼働中または検収待ちの業務台帳">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 上部サマリーカウンター */}
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm">
          <div className="text-sm font-black text-slate-700">
            現在の抱え中タスク総数: <span className="text-lg text-[#0082C8] font-black">{jobs.length}</span> 件
          </div>
        </div>

        {/* 現場特化型：格子状の進行中データテーブル */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto text-xs">
              <thead className="bg-slate-100 border-b-2 border-slate-300 text-slate-700 font-black">
                <tr>
                  <th className="p-3 border-r border-slate-300 w-28">稼働状況</th>
                  <th className="p-3 border-r border-slate-300 w-20 text-center">緊急度</th>
                  <th className="p-3 border-r border-slate-300 w-28">仕事種別</th>
                  <th className="p-3 border-r border-slate-300">案件名</th>
                  <th className="p-3 border-r border-slate-300 w-28">期日</th>
                  <th className="p-3 border-r border-slate-300 w-44">SCクライアント</th>
                  <th className="p-3 border-r border-slate-300 w-24 text-right">累積計測</th>
                  <th className="p-3 w-20 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800 bg-white">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                    
                    {/* 現在のステータスバッジ */}
                    <td className="p-3 border-r border-slate-200">
                      <span className={`px-2 py-0.5 border text-[10px] font-black rounded block text-center uppercase ${
                        job.status === 'working' ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse' :
                        job.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                        job.status === 'review' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                        'bg-blue-50 text-blue-700 border-blue-300'
                      }`}>
                        {job.status === 'working' ? '🔴 計測中' : 
                         job.status === 'paused' ? '⏸️ 一時停止' : 
                         job.status === 'review' ? '⌛ 検収待ち' : '📥 受諾済み'}
                      </span>
                    </td>

                    {/* 緊急度 */}
                    <td className="p-3 border-r border-slate-200 text-center">
                      {job.urgency === "3" ? (
                        <span className="bg-rose-100 text-rose-900 border border-rose-300 font-black px-1.5 py-0.5 rounded text-[10px] uppercase block">至急</span>
                      ) : job.urgency === "2" ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-400 font-black px-1.5 py-0.5 rounded text-[10px] block">高め</span>
                      ) : (
                        <span className="bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] block">通常</span>
                      )}
                    </td>

                    {/* 仕事種別 */}
                    <td className="p-3 border-r border-slate-200">
                      <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-[11px] font-bold block text-center">
                        {job.jobType === 'form_posting' ? '✉️ フォーム' : '📋 リスト作成'}
                      </span>
                    </td>

                    {/* ★大改造：案件名（タイトル）をクリックしても詳細・タイマー画面へ進めるようにLink化 */}
                    <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate max-w-xs" title={job.title}>
                      <Link 
                        href={`/worker/jobs/${job.id}`} 
                        className="hover:underline hover:text-[#0082C8] transition-colors block w-full truncate"
                      >
                        {job.title}
                      </Link>
                    </td>

                    {/* 期日 */}
                    <td className="p-3 border-r border-slate-200 font-mono font-bold text-slate-600">
                      {job.deadline ? job.deadline : <span className="text-slate-300 font-normal">未設定</span>}
                    </td>

                    {/* SCクライアント */}
                    <td className="p-3 border-r border-slate-200 text-slate-600 truncate max-w-[160px]" title={job.scClient}>
                      {job.scClient || "-"}
                    </td>

                    {/* 累積時間実績 */}
                    <td className="p-3 border-r border-slate-200 text-right font-mono font-bold text-slate-700">
                      {formatTime(job.totalAccumulatedSeconds || 0)}
                    </td>

                    {/* 操作エリア */}
                    <td className="p-3 text-center">
                      <Link href={`/worker/jobs/${job.id}`} className="text-[#0082C8] hover:underline font-black text-[11px]">
                        詳細 →
                      </Link>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {jobs.length === 0 && (
            <div className="p-16 text-center text-slate-400 italic text-xs font-medium bg-slate-50">
              現在、進行中のタスクはありません。「案件を探す」から引き受けてください。
            </div>
          )}
        </div>

      </div>
    </WorkerShell>
  );
}