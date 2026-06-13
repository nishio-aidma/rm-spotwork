"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerJobsPage() {
  const [allJobs, setAllJobs] = useState<any[]>([]); 
  const [filteredJobs, setFilteredJobs] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [userMap, setUserMap] = useState<{ [key: string]: string }>({}); // 💡 ワーカー名引換用の辞書ステートを新設

  // 現在アクティブな大分類タブを管理するステート
  const [activeTab, setActiveTab] = useState<'recruiting' | 'working' | 'completed'>('recruiting');

  // 絞り込みフィルターの選択状態
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterJobType, setFilterJobType] = useState<string>("all");
  const [filterUrgency, setFilterUrgency] = useState<string>("all");

  // カスタムモーダルポップアップ用の状態管理
  const [modalOpen, setModalOpen] = useState(false);
  const [targetJob, setTargetJob] = useState<{ id: string; title: string } | null>(null);

  // 今日の日付文字列（YYYY-MM-DD）を取得するヘルパー関数
  const getTodayStr = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // 案件とワーカー名簿を一括取得
  const fetchOwnerJobs = async () => {
    setLoading(true);
    try {
      // 💡 jobs（案件）と users（全ユーザー）を並列で爆速一括取得
      const [jobSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "jobs"))),
        getDocs(collection(db, "users"))
      ]);

      // 💡 会員番号（UID）から「姓名」を一発で引ける辞書マップを自動生成
      const uMap = Object.fromEntries(userSnap.docs.map(d => [
        d.id, 
        `${d.data().lastName || ""} ${d.data().firstName || ""}`.trim() || d.data().name || "不明のスタッフ"
      ]));
      setUserMap(uMap);

      const todayStr = getTodayStr();
      
      const jobList = jobSnap.docs.map(d => {
        const data = d.data() as any;
        let currentStatus = data.status || "draft";

        if (currentStatus === "open" && data.deadline && data.deadline < todayStr) {
          currentStatus = "expired";
        }

        return { id: d.id, ...data, status: currentStatus };
      });
      
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
        fetchOwnerJobs();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 大分類タブ ＆ トリプルフィルター掛け連動ロジック
  useEffect(() => {
    let result = [...allJobs];

    if (activeTab === "recruiting") {
      result = result.filter(job => job.status === "open" || job.status === "draft" || job.status === "expired");
    } else if (activeTab === "working") {
      result = result.filter(job => job.status === "assigned" || job.status === "working" || job.status === "paused");
    } else if (activeTab === "completed") {
      result = result.filter(job => job.status === "review" || job.status === "completed");
    }

    if (filterStatus !== "all") {
      result = result.filter(job => job.status === filterStatus);
    }

    if (filterJobType !== "all") {
      result = result.filter(job => job.jobType === filterJobType);
    }

    if (filterUrgency !== "all") {
      result = result.filter(job => job.urgency === filterUrgency);
    }

    setFilteredJobs(result);
  }, [activeTab, filterStatus, filterJobType, filterUrgency, allJobs]);

  const handleTabChange = (tab: 'recruiting' | 'working' | 'completed') => {
    setActiveTab(tab);
    setFilterStatus("all");
  };

  const recruitingCount = allJobs.filter(j => j.status === "open" || j.status === "draft" || j.status === "expired").length;
  const workingCount = allJobs.filter(j => j.status === "assigned" || j.status === "working" || j.status === "paused").length;
  const completedCount = allJobs.filter(j => j.status === "review" || j.status === "completed").length;

  const triggerDeleteModal = (jobId: string, title: string) => {
    setTargetJob({ id: jobId, title });
    setModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetJob) return;
    setModalOpen(false);

    try {
      await deleteDoc(doc(db, "jobs", targetJob.id));
      setAllJobs(prev => prev.filter(job => job.id !== targetJob.id));
    } catch (e) {
      console.error(e);
      alert("削除処理に失敗しました。");
    } finally {
      setTargetJob(null);
    }
  };

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
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div className="text-sm font-black text-slate-700 min-w-[100px]">
              表示件数: <span className="text-lg text-[#0082C8] font-black">{filteredJobs.length}</span> / {allJobs.length} 件
            </div>

            {/* 進捗フェーズ切り替えタブ */}
            <div className="flex bg-slate-100 p-1 rounded border border-slate-300 gap-1 select-none">
              <button
                type="button"
                onClick={() => handleTabChange('recruiting')}
                className={`px-3 py-1.5 rounded text-[11px] font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'recruiting'
                    ? 'bg-[#0082C8] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                📢 募集中
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'recruiting' ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'}`}>
                  {recruitingCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('working')}
                className={`px-3 py-1.5 rounded text-[11px] font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'working'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                📥 請負中
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'working' ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'}`}>
                  {workingCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('completed')}
                className={`px-3 py-1.5 rounded text-[11px] font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'completed'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                🏁 納品済
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'completed' ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-700'}`}>
                  {completedCount}
                </span>
              </button>
            </div>

            {/* ステータス詳細フィルター */}
            <div className="flex items-center gap-2 border-l xl:border-l-2 border-slate-300 pl-2 xl:pl-4">
              <label className="font-black text-slate-500">ステータス:</label>
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-50 border-2 border-slate-300 rounded px-2 py-1 font-bold text-slate-800 outline-none focus:border-[#0082C8]"
              >
                <option value="all">すべて</option>
                {activeTab === 'recruiting' && (
                  <>
                    <option value="draft">📁 下書き</option>
                    <option value="open">🟢 募集中</option>
                    <option value="expired">⏳ 期限切れ</option>
                  </>
                )}
                {activeTab === 'working' && (
                  <>
                    <option value="assigned">📥 受諾済み</option>
                    <option value="working">🔵 進行中</option>
                    <option value="paused">⏸️ 一時停止</option>
                  </>
                )}
                {activeTab === 'completed' && (
                  <>
                    <option value="review">🟡 検収待ち</option>
                    <option value="completed">🏁 完了</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
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

            <div className="flex items-center gap-2 border-l border-slate-200 pl-2">
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
            className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded border border-black/10 transition-colors shadow-sm text-center whitespace-nowrap self-start xl:self-auto"
          >
            ➕ 新規案件を作成する
          </Link>
        </div>

        {/* 2. 現場特化型データテーブル */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            {/* 💡 table-auto から table-fixed に変更。横幅をガチッと固定し、スクロール時のガタつきを完全破壊 */}
            <table className="w-full text-left border-collapse table-fixed text-xs min-w-[1000px]">
              <thead className="bg-slate-100 border-b-2 border-slate-300 text-slate-700 font-black">
                <tr>
                  <th className="p-3 border-r border-slate-300 w-24">ステータス</th>
                  <th className="p-3 border-r border-slate-300 w-20 text-center">緊急度</th>
                  <th className="p-3 border-r border-slate-300 w-26 text-center">仕事種別</th>
                  <th className="p-3 border-r border-slate-300 w-40">担当スタッフ</th> {/* 💡新設カラム！ */}
                  <th className="p-3 border-r border-slate-300">案件タイトル</th>
                  <th className="p-3 border-r border-slate-300 w-28 text-center">期日</th>
                  <th className="p-3 border-r border-slate-300 w-44">SCクライアント</th>
                  <th className="p-3 border-r border-slate-300 w-20 text-right">予定数</th>
                  <th className="p-3 w-12 text-center">操作</th> {/* 💡 w-28 から w-12 へ限界までスリム圧縮 */}
                </tr>
              </thead>
              
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredJobs.map((job) => {
                  const isUrgentDeadline = isThisWeekDeadline(job.deadline);

                  return (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      
                      {/* ステータスバッジ */}
                      <td className="p-3 border-r border-slate-200">
                        <span className={`px-2 py-0.5 border text-[10px] font-black rounded block text-center uppercase ${
                          job.status === 'open' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                          job.status === 'draft' ? 'bg-slate-100 text-slate-500 border-slate-300' :
                          job.status === 'expired' ? 'bg-red-100 text-red-800 border-red-300 font-extrabold' : 
                          job.status === 'assigned' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                          job.status === 'working' ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse' :
                          job.status === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                          job.status === 'review' ? 'bg-orange-50 text-orange-700 border-orange-300' :
                          job.status === 'completed' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {job.status === 'open' ? '募集中' : 
                           job.status === 'draft' ? '下書き' : 
                           job.status === 'expired' ? '期限切れ' : 
                           job.status === 'assigned' ? '受諾済み' : 
                           job.status === 'working' ? '進行中' : 
                           job.status === 'paused' ? '一時停止' : 
                           job.status === 'review' ? '検収待ち' : 
                           job.status === 'completed' ? '完了' : job.status}
                        </span>
                      </td>

                      {/* 緊急度 */}
                      <td className="p-3 border-r border-slate-300 text-center">
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

                      {/* 💡【新設】担当スタッフ表示セル（募集中・下書きの時はハイフンで美しく統一） */}
                      <td className="p-3 border-r border-slate-200 font-bold text-slate-700 truncate" title={job.workerId ? (userMap[job.workerId] || "不明のスタッフ") : "-"}>
                        {job.workerId ? (
                          userMap[job.workerId] || "不明のスタッフ"
                        ) : (
                          <span className="text-slate-300 font-normal select-none">-</span>
                        )}
                      </td>

                      {/* 案件タイトル */}
                      <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate" title={job.title}>
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
                      <td className="p-3 border-r border-slate-200 text-slate-600 truncate" title={job.scClient}>
                        {job.scClient || "-"}
                      </td>

                      {/* 予定数 */}
                      <td className="p-3 border-r border-slate-200 text-right font-mono font-bold">
                        {job.count || 0} 件
                      </td>

                      {/* 💡 操作エリア：ゴミ箱アイコンのみへ極限スリム化！ */}
                      <td className="p-3 text-center flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => triggerDeleteModal(job.id, job.title)}
                          className="text-slate-300 hover:text-rose-600 transition-colors p-1 text-sm active:scale-95"
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
              {activeTab === 'recruiting' && "該当する募集中・下書き・期限切れの案件はありません。"}
              {activeTab === 'working' && "該当するワーカー請割中・稼働中の案件はありません。"}
              {activeTab === 'completed' && "該当する納品済・完了の案件はありません。"}
            </div>
          )}
        </div>

      </div>

      {/* カスタム確認ポップアップ */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>⚠️ 案件の完全削除確認</span>
            </div>

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