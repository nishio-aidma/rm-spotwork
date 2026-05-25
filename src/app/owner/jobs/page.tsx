"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, deleteDoc, doc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerJobsPage() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [jobs, setJobs] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<any>({}); // ワーカー名を保持するマップ
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. 案件一覧を取得
      const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const jobList = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. ワーカー一覧を取得して名前のマップを作成
      const uSnap = await getDocs(query(collection(db, "users"), where("role", "==", "worker")));
      const users: any = {};
      uSnap.docs.forEach(d => {
        const u = d.data();
        users[d.id] = `${u.lastName || ""} ${u.firstName || ""}`.trim() || u.name || "未設定";
      });

      setUserMap(users);
      setJobs(jobList);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { if (!authLoading) fetchJobs(); }, [user, authLoading]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`案件「${title}」を完全に削除しますか？\n※この操作は取り消せません。`)) return;
    try {
      await deleteDoc(doc(db, "jobs", id));
      alert("削除が完了しました");
      fetchJobs();
    } catch (e) { 
      alert("削除に失敗しました"); 
    }
  };

  if (authLoading || loading) return <OwnerShell title="案件管理"><div className="p-10 text-slate-400 text-center text-sm">読み込み中...</div></OwnerShell>;

  return (
    <OwnerShell title="案件管理" subTitle="案件の掲載と進捗状況の確認">
      <div className="max-w-6xl mx-auto space-y-6 pb-20 text-slate-800">
        
        <div className="flex justify-between items-center border-b border-slate-100 pb-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">案件一覧</h2>
          <Link href="/owner/jobs/new" className="bg-slate-900 text-white px-5 py-2 rounded text-[11px] font-bold hover:bg-slate-800 transition-all shadow-sm">
            ＋ 新規案件を作成
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse table-auto">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">案件名 / タイプ</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap text-center">担当ワーカー</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap text-center">状態</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap text-center">稼働時間</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-700">{job.title}</div>
                    <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                      {job.jobType === 'form_posting' ? 'フォーム投稿' : 'リスト作成'}
                    </div>
                  </td>
                  
                  {/* 担当ワーカー名の表示：ここを修正しました */}
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-medium text-slate-600">
                      {job.workerId ? userMap[job.workerId] || "登録なし" : "—"}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-bold uppercase ${
                      job.status === 'working' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                      job.status === 'review' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      job.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                      'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {job.status === 'open' ? '未受諾' : 
                       job.status === 'assigned' ? '請負済' : 
                       job.status === 'working' ? '進行中' : 
                       job.status === 'review' ? '検収待ち' : 
                       job.status === 'completed' ? '完了' : job.status}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-center font-mono text-[11px] text-slate-400">
                    {Math.floor((job.totalAccumulatedSeconds || 0) / 3600)}h {Math.floor(((job.totalAccumulatedSeconds || 0) % 3600) / 60)}m
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-4">
                      <Link href={`/owner/jobs/${job.id}`} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 underline">
                        詳細を確認
                      </Link>
                      <button 
                        onClick={() => handleDelete(job.id, job.title)}
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        title="削除"
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