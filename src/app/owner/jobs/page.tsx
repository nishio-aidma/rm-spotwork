"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerJobsPage() {
  const [allJobs, setAllJobs] = useState<any[]>([]); 
  const [filteredJobs, setFilteredJobs] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  // 絞り込みフィルターの選択状態
  const [filterJobType, setFilterJobType] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");

  // 💡【新設】カスタムモーダルポップアップ用の状態管理
  const [modalOpen, setModalOpen] = useState(false);
  const [targetJob, setTargetJob] = useState<{ id: string; title: string } | null>(null);

  // 自分が発注した案件を一括取得
  const fetchOwnerJobs = async (userId: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, "jobs"), where("ownerId", "==", userId));
      const snap = await getDocs(q);
      
      const jobList = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      
      // 【期日（deadline）が近い順】に並び替え
      jobList.sort((a: any, b: any) => {
        const deadlineA = a.deadline && typeof a.deadline === "string" && a.deadline.trim() !== "" ? a.deadline : "9999-12-31";
        const deadlineB = b.deadline && typeof b.deadline === "string" && b.deadline.trim() !== "" ? b.deadline : "9999-12-31";
        
        if (deadlineA !== deadlineB) {
          return deadlineA.localeCompare(deadlineB);
        }
        
        const timeA = a["createdAt"]?.toDate ? a["createdAt"].toDate().getTime() : 0;
        const timeB = b["createdAt"]?.toDate ? b["createdAt"].toDate().getTime() : 0;
        return timeB - timeA;
      });

      setAllJobs(jobList);
      setFilteredJobs(jobList);
    } catch (e) {
      console.error("案件一覧の取得に失敗しました:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchOwnerJobs(user.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // フィルター連動
  useEffect(() => {
    let result = [...allJobs];

    if (filterJobType !== "all") {
      result = result.filter(job => job.jobType === filterJobType);
    }

    if (filterUrgency !== "all") {
      result = result.filter(job => job.urgency === filterUrgency);
    }

    setFilteredJobs(result);
  }, [filterJobType, filterUrgency, allJobs]);

  // モーダルを起動する窓口
  const triggerDeleteModal = (jobId: string, title: string) => {
    setTargetJob({ id: jobId, title });
    setModalOpen(true);
  };

  // 💡【確定処理】カスタムモーダル内から実行される完全削除ロジック
  const handleConfirmDelete = async () => {
    if (!targetJob) return;
    setModalOpen(false);

    try {
      await deleteDoc(doc(db, "jobs", targetJob.id));
      setAllJobs(prev => prev.filter(job => job.id !== targetJob.id));
      alert("案件を完全に削除しました。");
    } catch (e) {
      console.error(e);
      alert("削除処理に失敗しました。");
    } finally {
      setTargetJob(null);
    }
  };

  // 【今週締め切り判定関数】
  const isThisWeekDeadline = (deadlineStr: string) => {
    if (!deadlineStr || typeof deadlineStr !== "string" || deadlineStr.trim() === "") return false;
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const deadlineDate = new Date(deadlineStr);
      if (isNaN(deadlineDate.getTime())) return false;

      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);

      return deadlineDate <= sevenDaysLater;
    } catch {
      return false;
    }
  };

  if (loading) return <OwnerShell title="案件管理"><div className="p-10 text-center text-slate-400 text-xs font-bold">発注台帳を照合中...</div></OwnerShell>;

  return (
    <OwnerShell title="案件管理" subTitle="登録案件の公開状況およびステータス確認">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 上部コントロールバー ＆ 絞り込みコンソール */}
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div className="text-sm font-black text-slate-700">
              表示件数: <span className="text-lg text-[#0082C8] font-black">{filteredJobs.length}</span> / {allJobs.length} 件
            </div>

            <div className="flex items-center gap-2 border-l-2 border-slate-300 pl-4">
              <label className="font-black text-slate-500">仕事種別:</label>
              <select 
                value={filterJobType} 
                onChange={(e) => setFilterJobType(e.target.value)}
                className="bg-slate-50 border-2 border-slate-300 rounded px-2 py-1 font-bold text-slate-800 outline-none focus:border-[#0082C8]"
              >
                <option value="all">すべて表示</option>
                <option value="form_posting">✉️ フォーム投稿</option>
                <option value="list_creation">📋 リスト作成</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="font-black text-slate-500">緊急度:</label>
              <select 
                value={filterUrgency} 
                onChange={(e) => setFilterUrgency(e.target.value)}
                className="bg-slate-50 border-2 border-slate-300 rounded px-2 py-1 font-bold text-slate-800 outline-none focus:border-[#0082C8]"
              >
                <option value="all">すべて表示</option>
                <option value="3">🔴 至急</option>
                <option value="2">🟡 高め</option>
                <option value="1">通常</option>
              </select>
            </div>
          </div>

          <Link 
            href="/owner/jobs/new"
            className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded border border-black/10 transition-colors shadow-sm text-center whitespace-nowrap"
          >
            ➕ 新規案件を作成する
          </Link>
        </div>

        {/* 2. 現場特化型データテーブル */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto text-xs">
              <thead className="bg-slate-100 border-b-2 border-slate-300 text-slate-700 font-black">
                <tr>
                  <th className="p-3 border-r border-slate-300 w-24">状態</th>
                  <th className="p-3 border-r border-slate-300 w-20 text-center">緊急度</th>
                  <th className="p-3 border-r border-slate-300 w-28">仕事種別</th>
                  <th className="p-3 border-r border-slate-300">案件タイトル</th>
                  <th className="p-3 border-r border-slate-300 w-28">期日</th>
                  <th className="p-3 border-r border-slate-300 w-48">SCクライアント</th>
                  <th className="p-3 border-r border-slate-300 w-24 text-right">予定数</th>
                  <th className="p-3 w-28 text-center">操作</th>
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredJobs.map((job) => {
                  const isUrgentDeadline = isThisWeekDeadline(job.deadline);

                  return (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      
                      {/* 状態 */}
                      <td className="p-3 border-r border-slate-200">
                        <span className={`px-2 py-0.5 border text-[10px] font-black rounded block text-center uppercase ${
                          job.status === 'open' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                          job.status === 'draft' ? 'bg-slate-100 text-slate-500 border-slate-300' :
                          job.status === 'working' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                          job.status === 'review' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {job.status === 'open' ? '募集中' : 
                           job.status === 'draft' ? '下書き' : 
                           job.status === 'working' ? '進行中' : 
                           job.status === 'review' ? '検収待ち' : job.status}
                        </span>
                      </td>

                      {/* 緊急度 */}
                      <td className="p-3 border-r border-slate-200 text-center">
                        {job.urgency === "3" ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-300 font-black px-1.5 py-0.5 rounded text-[10px] uppercase block animate-pulse">至急</span>
                        ) : job.urgency === "2" ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-300 font-black px-1.5 py-0.5 rounded text-[10px] block">高め</span>
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

                      {/* 案件タイトル */}
                      <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate max-w-xs" title={job.title}>
                        <Link 
                          href={`/owner/jobs/${job.id}`} 
                          className="hover:underline hover:text-[#0082C8] transition-colors block w-full truncate"
                        >
                          {job.title}
                        </Link>
                      </td>

                      {/* 期日 */}
                      <td className={`p-3 border-r border-slate-200 font-mono font-bold text-center ${
                        isUrgentDeadline 
                          ? 'bg-rose-100 text-rose-900 border-2 border-rose-300 rounded animate-pulse' 
                          : 'text-slate-600'
                      }`}>
                        {job.deadline ? job.deadline : <span className="text-slate-300 font-normal">未設定</span>}
                      </td>

                      {/* SCクライアント */}
                      <td className="p-3 border-r border-slate-200 text-slate-600 truncate max-w-[180px]" title={job.scClient}>
                        {job.scClient || "-"}
                      </td>

                      {/* 予定数 */}
                      <td className="p-3 border-r border-slate-200 text-right font-mono font-bold">
                        {job.count || 0} 件
                      </td>

                      {/* 操作エリア */}
                      <td className="p-3 text-center flex items-center justify-center gap-3">
                        <Link href={`/owner/jobs/${job.id}`} className="text-[#0082C8] hover:underline font-black text-[11px]">
                          詳細 →
                        </Link>
                        {/* 💡window.confirmではなくカスタムモーダルを起動するように変更 */}
                        <button
                          onClick={() => triggerDeleteModal(job.id, job.title)}
                          className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                          title="この案件をデータベースから完全削除"
                        >
                          🗑️
                        </button>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredJobs.length === 0 && (
            <div className="p-16 text-center text-slate-400 italic font-medium bg-slate-50">
              該当する案件は登録されていません。
            </div>
          )}
        </div>

      </div>

      {/* 💡【超シンプル化リフォーム】オーナー側の案件削除確認ポップアップも、フチ取り線を削ぎ落とした極上シンプルモダンデザインへ完全統一！ */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            {/* ポップアップヘッダー：クリーンブルーのモダン細帯 */}
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>⚠️ 案件の完全削除確認</span>
            </div>

            {/* ポップアップ本文：純白でシャープな見やすさ */}
            <div className="p-6 bg-white space-y-3">
              <p className="text-xs font-bold text-rose-600 leading-relaxed">
                【警告】この案件をデータベースから完全に消去しますか？
              </p>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold text-slate-700 truncate">
                対象：{targetJob?.title}
              </div>
              <p className="text-[11px] font-medium text-slate-400">
                ※この操作を実行すると、ワーカー側のタスク一覧からも完全に消滅し、二度と復元できません。
              </p>
            </div>

            {/* アクションボタン：グレー＆ブルーの洗練されたフラット配置 */}
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
              >
                完全に削除する
              </button>
            </div>

          </div>
        </div>
      )}

    </OwnerShell>
  );
}