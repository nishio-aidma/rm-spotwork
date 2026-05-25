"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerJobsPage() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { if (!authLoading) fetchJobs(); }, [user, authLoading]);

  // ★ 案件削除関数
  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`案件「${title}」を完全に削除しますか？\n※この案件に関連するデータも閲覧できなくなります。`)) return;
    try {
      await deleteDoc(doc(db, "jobs", id));
      alert("削除が完了しました");
      fetchJobs(); // 一覧を更新
    } catch (e) { alert("削除に失敗しました"); }
  };

  if (authLoading || loading) return <OwnerShell title="Jobs"><div className="p-10 italic text-slate-400 text-center">Loading Tasks...</div></OwnerShell>;

  return (
    <OwnerShell title="Job Management" subTitle="案件の掲載・進捗管理">
      <div className="max-w-6xl mx-auto space-y-6 pb-20 font-sans">
        
        <div className="flex justify-between items-center">
          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Jobs</h2>
          <Link href="/owner/jobs/new" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[11px] font-black shadow-lg hover:bg-indigo-700 transition-all">
            ＋ 新規案件を作成
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">案件名 / タイプ</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">ステータス</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">稼働時間</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">アクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-[11px]">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{job.title}</div>
                    <div className="text-[8px] text-slate-300 font-black uppercase mt-0.5">
                      {job.jobType === 'form_posting' ? '✉️ Form Posting' : '📋 List Creation'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 rounded-md font-black text-[9px] uppercase ${
                      job.status === 'working' ? 'bg-indigo-50 text-indigo-600' :
                      job.status === 'review' ? 'bg-amber-50 text-amber-600' :
                      job.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-slate-400">
                    {Math.floor((job.totalAccumulatedSeconds || 0) / 3600)}h {Math.floor(((job.totalAccumulatedSeconds || 0) % 3600) / 60)}m
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-3">
                      <Link href={`/owner/jobs/${job.id}`} className="text-slate-400 hover:text-indigo-600 transition-colors">
                        詳細 ≫
                      </Link>
                      {/* 削除ボタン */}
                      <button 
                        onClick={() => handleDelete(job.id, job.title)}
                        className="p-1.5 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <span className="text-xs">🗑️</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </OwnerShell>
  );
}