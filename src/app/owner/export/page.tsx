"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, where, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

export default function OwnerExportPage() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [viewDate, setViewDate] = useState(new Date());
  const [exporting, setExporting] = useState(false);
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 代理確定モーダル制御用ステート
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [targetWorker, setTargetWorker] = useState<{ id: string; name: string } | null>(null);

  // カスタム通知モーダル用ステート
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalTitle, setInfoModalTitle] = useState("");
  const [infoModalMessage, setInfoModalMessage] = useState("");

  const showNotification = (title: string, msg: string) => {
    setInfoModalTitle(title);
    setInfoModalMessage(msg);
    setInfoModalOpen(true);
  };

  // 指定した月の集計データを取得
  const fetchSummary = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const currentMonthStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`; // 例: "2026-07"

      // jobs（案件）、users（ワーカー）、月次確定ステータス、稼働ログ（workLogs）を全取得
      const [jobSnap, userSnap, statusSnap, logSnap] = await Promise.all([
        getDocs(collection(db, "jobs")),
        getDocs(query(collection(db, "users"), where("role", "==", "worker"))),
        getDocs(collection(db, "workerMonthlyStatus")),
        getDocs(collection(db, "workLogs"))
      ]);

      // ワーカーIDから名前を引ける辞書
      const userMap = Object.fromEntries(userSnap.docs.map(d => [
        d.id, 
        `${d.data().lastName || ""} ${d.data().firstName || ""}`.trim() || d.data().name || "不明"
      ]));

      // ワーカーごとの月次確定ステータスを引ける辞書を作成
      const statusMap: { [key: string]: string } = {};
      statusSnap.docs.forEach(d => {
        const sData = d.data();
        if (sData.yearMonth === currentMonthStr && sData.workerId) {
          statusMap[sData.workerId] = sData.status || "none";
        }
      });

      const workerAgg: any = {};
      const targetYear = viewDate.getFullYear();
      const targetMonth = viewDate.getMonth();

      // ロジック①：まずは「jobs」から案件の請負数・完了数を集計
      jobSnap.docs.forEach(d => {
        const job = d.data();
        const wId = job.workerId;

        if (!wId || job.status === "open" || job.status === "draft") return;

        const jobTimestamp = job.updatedAt || job.createdAt;
        if (jobTimestamp) {
          const jDate = jobTimestamp.toDate ? jobTimestamp.toDate() : new Date(jobTimestamp);
          const isCurrentMonth = jDate.getFullYear() === targetYear && jDate.getMonth() === targetMonth;
          
          if (isCurrentMonth) {
            if (!workerAgg[wId]) {
              workerAgg[wId] = { 
                workerId: wId,
                name: userMap[wId] || "不明のワーカー", 
                activeDays: new Set(), 
                acceptedCount: 0, 
                completedCount: 0, 
                totalSeconds: 0,
                submissionStatus: statusMap[wId] || "none" 
              };
            }

            const w = workerAgg[wId];
            w.acceptedCount++;

            if (job.status === "completed") {
              w.completedCount++;
            }
          }
        }
      });

      // ロジック②：手動追加分を含む「workLogs」から、正確な稼働時間と活動日数を集計
      logSnap.docs.forEach(d => {
        const log = d.data();
        const wId = log.workerId;

        if (!wId) return;

        let endTime = null;
        if (log.timestamp) {
          if (typeof log.timestamp.toDate === 'function') {
            endTime = log.timestamp.toDate();
          } else if (log.timestamp instanceof Date) {
            endTime = log.timestamp;
          } else if (log.timestamp.seconds) {
            endTime = new Date(log.timestamp.seconds * 1000);
          } else {
            endTime = new Date(log.timestamp);
          }
        }

        if (!endTime || isNaN(endTime.getTime())) return;

        const startTime = new Date(endTime.getTime() - (log.seconds || 0) * 1000);
        const isCurrentMonth = startTime.getFullYear() === targetYear && startTime.getMonth() === targetMonth;

        if (isCurrentMonth) {
          if (!workerAgg[wId]) {
            workerAgg[wId] = { 
              workerId: wId,
              name: userMap[wId] || "不明のワーカー", 
              activeDays: new Set(), 
              acceptedCount: 0, 
              completedCount: 0, 
              totalSeconds: 0,
              submissionStatus: statusMap[wId] || "none" 
            };
          }

          const w = workerAgg[wId];
          w.totalSeconds += (Number(log.seconds) || 0);
          w.activeDays.add(startTime.toDateString());
        }
      });

      setSummaryData(Object.values(workerAgg).map((w: any) => ({
        ...w,
        activeDays: w.activeDays.size === 0 ? 1 : w.activeDays.size,
        duration: (w.totalSeconds / 3600).toFixed(2)
      })));

    } catch (e) { 
      console.error("Data fetch error", e); 
    } finally { 
      setLoadingData(false); 
    }
  };

  useEffect(() => { 
    if (!authLoading) fetchSummary(); 
  }, [viewDate, user, authLoading]);

  // オーナーによる代理確定（月締め手動承認）の実行関数
  const handleConfirmProxyApprove = async () => {
    if (!targetWorker) return;
    setConfirmModalOpen(false);
    setSubmitting(true);

    try {
      const currentMonthStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
      const docId = `${targetWorker.id}_${currentMonthStr}`;
      
      const targetWorkerData = summaryData.find(w => w.workerId === targetWorker.id);
      const totalSec = targetWorkerData ? targetWorkerData.totalSeconds : 0;

      // workerMonthlyStatus に status: "confirmed" を作成・更新
      await setDoc(doc(db, "workerMonthlyStatus", docId), {
        workerId: targetWorker.id,
        yearMonth: currentMonthStr,
        status: "confirmed",
        totalSeconds: totalSec,
        updatedAt: serverTimestamp(),
        approvedByOwner: true
      }, { merge: true });

      showNotification("✨ 代理確定完了", `【${targetWorker.name}】さんの ${currentMonthStr} 月度稼働実績を『確認済み（確定）』に更新しました。`);
      fetchSummary();
    } catch (e) {
      console.error("代理確定エラー:", e);
      showNotification("⚠️ エラー", "代理確定処理に失敗しました。ネットワーク状況をご確認ください。");
    } finally {
      setSubmitting(false);
      setTargetWorker(null);
    }
  };

  // CSVダウンロード実行関数
  const handleExport = () => {
    if (summaryData.length === 0) {
      showNotification("⚠️ エラー", "出力できるデータがありません。");
      return;
    }
    setExporting(true);

    try {
      const headers = ["ワーカー名", "活動日数", "案件請負数", "案件完了数", "稼働時間(h)", "提出ステータス"];
      
      const rows = summaryData.map(data => [
        `"${data.name}"`,
        data.activeDays,
        data.acceptedCount,
        data.completedCount,
        data.duration,
        data.submissionStatus === "confirmed" ? '"確認済み"' : '"未提出"'
      ].join(","));

      const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${viewDate.getFullYear()}年${viewDate.getMonth() + 1}月実績レポート.csv`;
      
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setExporting(false);
      }, 100);

    } catch (e) {
      console.error("Download Error:", e);
      showNotification("⚠️ エラー", "CSV生成中にエラーが発生しました。");
      setExporting(false);
    }
  };

  const hasData = summaryData.length > 0;
  const unsubmittedCount = summaryData.filter(w => w.submissionStatus !== "confirmed").length;
  const isAllSubmitted = hasData && unsubmittedCount === 0;

  return (
    <OwnerShell title="データ出力" subTitle="月次実績の確認とCSV出力">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 管理者用公式マニュアル常設リンクボード */}
        <div className="bg-slate-900 text-white p-4 rounded border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md select-none animate-fade-in">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">OFFICIAL MANUAL</span>
              <h4 className="text-xs font-black text-slate-100 tracking-wide">すきわ〜く 管理者用運用マニュアル</h4>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">月次実績データの集計定義、CSV出力手順、ワーカー締め処理の確定フローはこちらの公式ドキュメントをご確認ください。</p>
          </div>
          <a 
            href="https://docs.google.com/document/d/1pWkgdqFzsImV3NUZY1xFT1f_0j1KjhsjsBgB_1lH8oI/edit?usp=sharing"
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-xs font-black px-4 py-2 rounded text-center transition-all shadow-sm active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer"
          >
            📘 マニュアルを開く ↗
          </a>
        </div>

        {/* 月次締めステータス監視アラートボード */}
        {hasData && !loadingData && (
          <div className={`p-4 rounded border-2 shadow-sm flex items-center gap-3 transition-all ${
            isAllSubmitted 
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
              : 'bg-amber-50 border-amber-300 text-amber-800'
          }`}>
            <span className="text-base select-none">{isAllSubmitted ? "✨" : "⚠️"}</span>
            <div className="text-xs font-black leading-relaxed">
              {isAllSubmitted ? (
                <p>対象月の稼働スタッフ全員（<span className="text-sm font-mono">{summaryData.length}</span>名）が月次締め（実績提出）を完了しました。今月度の稼働データを安全に出力できます。</p>
              ) : (
                <p>
                  月次締めが未提出の稼働スタッフが <span className="text-sm font-mono text-rose-600 font-black px-1">{unsubmittedCount}</span> 名います。
                  <br />
                  <span className="font-normal text-[11px] text-slate-600">※日々の打刻チェックが完了している場合は、下記テーブルの「代理確定する」ボタンを押すことで、オーナー側で即座に確認済みに変更してデータ出力を解除できます。</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* 1. 操作パネル */}
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-black text-slate-500 whitespace-nowrap">対象月選択:</span>
            <input 
              type="month" 
              value={`${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => setViewDate(new Date(e.target.value))}
              className="text-xs font-black bg-white border-2 border-slate-300 rounded px-3 py-2 outline-none focus:border-[#5CA685] w-full sm:w-auto"
            />
          </div>
          
          <button 
            onClick={handleExport}
            disabled={exporting || !isAllSubmitted}
            className="w-full sm:w-auto bg-[#5CA685] hover:bg-[#4A9272] text-white border border-black/10 px-6 py-2.5 rounded text-xs font-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            📥 {exporting ? "CSV生成中..." : "表示内容をCSVで出力する"}
          </button>
        </div>

        {/* 2. 実績プレビューテーブル */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b-2 border-slate-300 bg-slate-100 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">実績プレビュー</h3>
            {loadingData && <span className="text-[11px] text-[#5CA685] font-black animate-pulse">リアルタイム集計中...</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-300 text-[11px] text-slate-500 font-black">
                  <th className="p-3 border-r border-slate-200">ワーカー名</th>
                  <th className="p-3 border-r border-slate-200 text-right w-24">活動日数</th>
                  <th className="p-3 border-r border-slate-200 text-right w-24">案件請負数</th>
                  <th className="p-3 border-r border-slate-200 text-right w-24">案件完了数</th>
                  <th className="p-3 border-r border-slate-200 text-right w-28">総稼働時間</th>
                  <th className="p-3 text-center w-48">月次提出ステータス</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800">
                {summaryData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 border-r border-slate-200 font-bold text-slate-900">{row.name}</td>
                    <td className="p-3 border-r border-slate-200 text-right font-mono text-slate-600">{row.activeDays} 日</td>
                    <td className="p-3 border-r border-slate-200 text-right font-mono text-slate-600">{row.acceptedCount} 件</td>
                    <td className="p-3 border-r border-slate-200 text-right font-mono font-black text-emerald-600">{row.completedCount} 件</td>
                    <td className="p-3 border-r border-slate-200 text-right font-mono font-black text-[#5CA685] bg-slate-50/50">{row.duration} h</td>
                    <td className="p-3 text-center">
                      {row.submissionStatus === "confirmed" ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded shadow-inner">
                          ✓ 確認済み
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black px-2 py-0.5 rounded animate-pulse">
                            ⏳ 未提出
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetWorker({ id: row.workerId, name: row.name });
                              setConfirmModalOpen(true);
                            }}
                            disabled={submitting}
                            className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-2.5 py-1 rounded shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                            title="オーナーの権限でこのワーカーの当月稼働を承認（確定）にします"
                          >
                            代理確定する
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!loadingData && summaryData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-slate-400 italic text-xs font-medium bg-slate-50">
                      選択された月の稼働データはありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 代理確定モーダル */}
      {confirmModalOpen && targetWorker && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            <div className="bg-[#5CA685] text-white px-4 py-3 font-black text-xs select-none">
              <span>⚠️ 月次稼働の代理確定確認</span>
            </div>
            <div className="p-6 bg-white space-y-2">
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                【{targetWorker.name}】さんの {viewDate.getFullYear()}年{viewDate.getMonth() + 1}月度の月次稼働実績を、オーナー権限で『確認済み（確定）』に変更しますか？
              </p>
              <p className="text-[10px] text-slate-400 font-medium">
                ※確定にするとステータスが『確認済み』に切り替わり、CSV出力のロックが解除されます。
              </p>
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => { setConfirmModalOpen(false); setTargetWorker(null); }}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmProxyApprove}
                disabled={submitting}
                className="px-4 py-2 bg-[#5CA685] hover:bg-[#4A9272] text-white font-black text-xs rounded shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? "確定処理中..." : "はい、代理確定する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カスタム通知モーダル */}
      {infoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            <div className="bg-[#5CA685] text-white px-4 py-3 font-black text-xs select-none">
              <span>{infoModalTitle}</span>
            </div>
            <div className="p-6 bg-white">
              <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                {infoModalMessage}
              </p>
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end">
              <button
                type="button"
                onClick={() => setInfoModalOpen(false)}
                className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded shadow-sm cursor-pointer"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </OwnerShell>
  );
}