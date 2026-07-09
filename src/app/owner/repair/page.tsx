"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";
import Image from "next/image"; // ロゴ用に追加

export default function RepairDataPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await fetchRuinedJobs();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 🚨 壊れたデータ（満員なのにopenになっているもの）だけを拾い上げる関数
  const fetchRuinedJobs = async () => {
    setLoading(true);
    try {
      const jobSnap = await getDocs(query(collection(db, "jobs")));
      const jobList = jobSnap.docs.map(d => {
        const data = d.data() as any;
        let savedOriginalStatus = "assigned"; // 万が一のための予備

        // 退避されている本来のステータスを探す
        if (data.workers) {
          const workerUids = Object.keys(data.workers);
          if (workerUids.length > 0) {
            const firstWorkerUid = workerUids[0];
            savedOriginalStatus = data.workers[firstWorkerUid]?.status || "assigned";
          }
        }

        const currentWorkerCount = data.workers ? Object.keys(data.workers).length : 0;
        // 定員が設定されていない場合は1人として扱う
        const limit = data.workerLimit || 1;

        // 【重要】今回のミスで破壊されたデータ（満員なのにopenになっているデータ）を検出
        // ただし、2人以上募集できる案件はopenのままで正解なので、1人しか請け負えない案件（limit === 1）だけを対象にする
        const isRuined = data.status === "open" && currentWorkerCount >= limit && limit === 1 && currentWorkerCount > 0;

        return {
          id: d.id,
          title: data.title || "タイトルなし",
          currentOverallStatus: data.status,
          savedOriginalStatus: savedOriginalStatus,
          isRuined: isRuined
        };
      });

      // 壊れているデータのみをリスト化
      const targetList = jobList.filter(j => j.isRuined);
      setJobs(targetList);
    } catch (e) {
      console.error("データ取得エラー:", e);
    } finally {
      setLoading(false);
    }
  };

  // 🚨 データを本来のステータスに上書き修復する関数
  const handleRestoreData = async () => {
    setIsRestoring(true);
    setRestoreModalOpen(false);
    try {
      let count = 0;
      for (const job of jobs) {
        const jobRef = doc(db, "jobs", job.id);
        
        // 全体ステータスを退避されていた元の正しいステータスで上書き
        await updateDoc(jobRef, {
          status: job.savedOriginalStatus
        });
        count++;
      }

      setSuccessMessage(`修復完了：${count}件のデータを本来のステータスに復旧しました。`);
      await fetchRuinedJobs(); // リストを更新（修復が成功すれば0件になるはず）
    } catch (e) {
      console.error("復旧処理エラー:", e);
      alert("復旧処理中にエラーが発生しました。");
    } finally {
      setIsRestoring(false);
    }
  };

  if (loading) return <OwnerShell title="データ緊急修復ツール"><div className="p-10 text-center text-xs font-bold text-slate-400">破壊されたデータを検索中...</div></OwnerShell>;

  return (
    <OwnerShell title="データ緊急修復ツール" subTitle="誤ってopenにされたデータを元の状態に戻す">
      <div className="max-w-4xl mx-auto space-y-6 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 修復成功時のメッセージ */}
        {successMessage && (
          <div className="bg-emerald-50 border-2 border-emerald-400 p-4 rounded text-emerald-800 font-black text-sm flex justify-between items-center shadow-sm">
            <span>✨ {successMessage}</span>
            <Link href="/owner/jobs" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-xs transition-colors">
              案件一覧へ戻って確認する
            </Link>
          </div>
        )}

        <div className="bg-rose-50 p-4 rounded border-2 border-rose-300 shadow-sm flex items-center gap-3">
          <Image src="/logo.png" alt="Spotwork" width={48} height={48} className="shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-rose-900 leading-relaxed mb-3">
              🚨 誤って全体のステータスが「募集中（open）」に書き換えられてしまった1人定員案件が <span className="text-sm text-rose-600 font-black">{jobs.length}</span> 件見つかりました。<br />
              下のボタンを押すと、ワーカー個人のカルテに退避されている本来のステータス（completedやpaused）を読み取り、自動で元通りに修復します。
            </p>
            <button
              type="button"
              disabled={jobs.length === 0 || isRestoring}
              onClick={() => setRestoreModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-6 py-3 rounded shadow-md border border-black/10 transition-all active:scale-95 disabled:opacity-50"
            >
              {isRestoring ? "データを修復中..." : "🚑 壊れたデータをすべて元通りに修復する"}
            </button>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b-2 border-slate-300 text-slate-700 font-black">
              <tr>
                <th className="p-3 border-r border-slate-200">案件タイトル</th>
                <th className="p-3 border-r border-slate-200 text-center w-36">現在の異常な状態</th>
                <th className="p-3 text-center w-48 text-blue-800">修復予定の本来の状態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-medium divide-slate-200">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate max-w-xs" title={job.title}>
                    {job.title}
                  </td>
                  <td className="p-3 border-r border-slate-200 text-center">
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-300 text-[10px] font-black rounded uppercase block">
                      {job.currentOverallStatus}
                    </span>
                  </td>
                  <td className="p-3 text-center bg-blue-50/20 font-black">
                    <span className={`px-2 py-1 rounded text-[11px] border font-mono ${
                      job.savedOriginalStatus === 'completed' ? 'bg-slate-100 text-slate-700 border-slate-400 font-black' :
                      job.savedOriginalStatus === 'paused' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                      job.savedOriginalStatus === 'review' ? 'bg-orange-50 text-orange-700 border-orange-300' :
                      job.savedOriginalStatus === 'working' ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse' :
                      job.savedOriginalStatus === 'assigned' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                      'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      ⬅️ {job.savedOriginalStatus === 'completed' ? '🏁 completed' :
                       job.savedOriginalStatus === 'paused' ? '⏸️ paused' :
                       job.savedOriginalStatus === 'review' ? '🟡 review' : 
                       job.savedOriginalStatus === 'working' ? '🔵 working' :
                       job.savedOriginalStatus === 'assigned' ? '📥 assigned' : job.savedOriginalStatus} に戻します
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 && (
            <div className="p-10 text-center text-slate-400 font-bold divide-slate-200">
              修復が必要な1人定員案件は見つかりませんでした。<br />
              テストデータのみが壊れていた可能性があります。その場合は、このファイルを捨てて通常営業に戻ってください。
            </div>
          )}
        </div>

      </div>

      {/* 復旧実行の確認モーダル */}
      {restoreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900 transition-all">
            <div className="bg-rose-600 text-white px-4 py-3 font-black text-xs select-none flex justify-between items-center tracking-wide">
              <span>⚠️ データ自動修復の最終実行確認</span>
            </div>
            <div className="p-6 bg-white space-y-3">
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                異常なステータスになっている {jobs.length} 件のデータを、ワーカーカルテに残っている本来のステータスに上書きして修復します。よろしいですか？
              </p>
              <p className="text-[11px] font-medium text-slate-400">
                ※この操作を実行すると、データベースが直接書き換わります。修復完了後、一覧画面のタブ配置が元通りに直ります。
              </p>
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide"
                onClick={() => setRestoreModalOpen(false)}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleRestoreData}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
              >
                修復を実行する
              </button>
            </div>
          </div>
        </div>
      )}
    </OwnerShell>
  );
}