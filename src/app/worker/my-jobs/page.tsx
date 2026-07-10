"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import WorkerShell from "@/components/WorkerShell";
import Link from "next/link";

export default function WorkerMyJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 'active': 稼働中 / 'review': 検収待ち
  const [activeTab, setActiveTab] = useState<'active' | 'review'>('active');

  const fetchMyJobs = async (userId: string) => {
    setLoading(true);
    try {
      // 💡インデックスエラーを100%防ぐため、一旦jobsコレクション全体を安全に取得
      const q = query(collection(db, "jobs"));
      const snap = await getDocs(q);
      
      // 💡取得したデータから、自分に関係のある案件だけを抽出・整形する
      const list = snap.docs.map(d => {
        const data = d.data() as any;
        
        // 初期値として全体のステータスと秒数をセット（古い形式への互換性用）
        let myStatus = data.status || "draft";
        let mySeconds = data.totalAccumulatedSeconds || 0;
        let isParticipant = data.workerId === userId; // 古い形式で自分が担当か

        // 新しい複数人用の箱（workersマップ）が存在し、その中に自分のIDがある場合
        if (data.workers && data.workers[userId]) {
          myStatus = data.workers[userId].status; // 全体のstatusではなく「自分個人」のstatusを採用
          mySeconds = data.workers[userId].totalAccumulatedSeconds || 0;
          isParticipant = true; // 新しい形式で自分が参加している証明
        }

        return { 
          id: d.id, 
          ...data, 
          status: myStatus, // 既存ロジックを壊さないよう、statusの中身を「個人ステータス」に上書き
          totalAccumulatedSeconds: mySeconds,
          isParticipant: isParticipant
        };
      });

      // 自分自身が請け負っている案件だけを絞り込む
      const myActiveJobs = list.filter((j: any) => 
        j.isParticipant && (j.status === "assigned" || j.status === "working" || j.status === "paused" || j.status === "review")
      );

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

  const filteredJobs = jobs.filter((job) => {
    if (activeTab === 'active') {
      return job.status === 'assigned' || job.status === 'working' || job.status === 'paused';
    } else {
      return job.status === 'review';
    }
  });

  const activeCount = jobs.filter(j => j.status === 'assigned' || j.status === 'working' || j.status === 'paused').length;
  const reviewCount = jobs.filter(j => j.status === 'review').length;

  if (loading) return <WorkerShell title="進行中のタスク"><div className="p-10 text-center text-slate-400 text-xs font-bold">マイタスクを照合中...</div></WorkerShell>;

  return (
    <WorkerShell title="進行中のタスク" subTitle="あなたが受諾し、現在稼働中または検収待ちの業務台帳">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 敷き詰め型フルワイド2大タブ */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm flex overflow-hidden select-none h-11 items-stretch">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`flex-1 text-center text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-[#0082C8] text-white shadow-inner'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            🚀 作業中・未完了 ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`flex-1 text-center text-xs font-black transition-all flex items-center justify-center gap-1.5 border-l border-slate-200 ${
              activeTab === 'review'
                ? 'bg-[#0082C8] text-white shadow-inner'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            ⌛ 報告済み・検収待ち ({reviewCount})
          </button>
        </div>

        {/* テーブルの上の件数表示 */}
        <div className="text-xs font-black text-slate-500 pl-1 select-none">
          📋 現在請負中のお仕事: <span className="text-sm text-[#0082C8] font-black font-mono">{jobs.length}</span> 件
        </div>

        {/* 格子状の進行中データテーブル */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed text-xs min-w-[1000px]">
              <thead className="bg-slate-100 border-b-2 border-slate-300 text-slate-700 font-black">
                <tr>
                  <th className="p-3 border-r border-slate-300 w-28 text-center">稼働状況</th>
                  <th className="p-3 border-r border-slate-300 w-20 text-center">緊急度</th>
                  <th className="p-3 border-r border-slate-300 w-26 text-center">仕事種別</th>
                  <th className="p-3 border-r border-slate-300">案件名</th>
                  <th className="p-3 border-r border-slate-300 w-28 text-center">期日</th>
                  <th className="p-3 border-r border-slate-300 w-44">SCクライアント</th>
                  <th className="p-3 border-r border-slate-300 w-24 text-right">累積計測</th>
                  <th className="p-3 w-20 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800 bg-white">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 transition-colors">
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

                    <td className="p-3 border-r border-slate-200 text-center">
                      {job.urgency === "3" ? (
                        <span className="bg-rose-50 text-rose-700 border border-rose-300 font-black px-1.5 py-0.5 rounded text-[10px] uppercase block">至急</span>
                      ) : job.urgency === "2" ? (
                        <span className="bg-amber-50 text-amber-700 border border-amber-300 font-black px-1.5 py-0.5 rounded text-[10px] block">高め</span>
                      ) : (
                        <span className="bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] block">通常</span>
                      )}
                    </td>

                    <td className="p-3 border-r border-slate-200">
                      <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded text-[11px] font-bold block text-center">
                        {job.jobType === 'form_posting' ? '✉️ フォーム' : '📋 リスト作成'}
                      </span>
                    </td>

                    <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate" title={job.title}>
                      <Link 
                        href={`/worker/jobs/${job.id}`} 
                        className="hover:underline hover:text-[#0082C8] transition-colors block w-full truncate"
                      >
                        {job.title}
                      </Link>
                    </td>

                    <td className="p-3 border-r border-slate-200 font-mono font-black text-center text-sm text-slate-600">
                      {job.deadline ? job.deadline : <span className="text-slate-300 font-normal text-xs">未設定</span>}
                    </td>

                    <td className="p-3 border-r border-slate-200 text-slate-600 truncate">
                      {job.scClient || "-"}
                    </td>

                    <td className="p-3 border-r border-slate-200 text-right font-mono font-black text-sm text-slate-700 bg-slate-50/30">
                      {formatTime(job.totalAccumulatedSeconds || 0)}
                    </td>

                    <td className="p-3 text-center">
                      <Link href={`/worker/jobs/${job.id}`} className="text-[#0082C8] hover:underline font-black text-[11px] block active:scale-95 transition-transform">
                        詳細 →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredJobs.length === 0 && (
            <div className="p-16 text-center text-slate-400 italic text-xs font-medium bg-slate-50">
              {activeTab === 'active' 
                ? "現在、作業中・未完了のタスクはありません。" 
                : "提出済みの検収待ちタスクはありません。"}
            </div>
          )}
        </div>

      </div>
    </WorkerShell>
  );
}