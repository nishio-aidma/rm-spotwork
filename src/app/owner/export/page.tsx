"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, where, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

export default function OwnerExportPage() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [viewDate, setViewDate] = useState(new Date());
  const [exporting, setExporting] = useState(false);
  const [summaryData, setSummaryData] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // 指定した月の集計データを取得
  const fetchSummary = async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);

      const [logSnap, jobSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "workLogs"), where("timestamp", ">=", Timestamp.fromDate(start)), where("timestamp", "<=", Timestamp.fromDate(end)))),
        getDocs(collection(db, "jobs")),
        getDocs(query(collection(db, "users"), where("role", "==", "worker")))
      ]);

      const userMap = Object.fromEntries(userSnap.docs.map(d => [d.id, `${d.data().lastName || ""} ${d.data().firstName || ""}`.trim() || d.data().name || "不明"]));

      const workerAgg: any = {};
      logSnap.docs.forEach(d => {
        const log = d.data();
        const wId = log.workerId;
        if (!workerAgg[wId]) {
          workerAgg[wId] = { name: userMap[wId], activeDays: new Set(), jobIds: new Set(), completedCount: 0, totalSeconds: 0 };
        }
        workerAgg[wId].totalSeconds += (log.seconds || 0);
        workerAgg[wId].jobIds.add(log.jobId);
        if (log.timestamp) workerAgg[wId].activeDays.add(log.timestamp.toDate().toDateString());
      });

      jobSnap.docs.forEach(d => {
        const job = d.data();
        if (job.status === 'completed' && job.completedAt && job.workerId) {
          const cDate = job.completedAt.toDate();
          if (cDate.getFullYear() === viewDate.getFullYear() && cDate.getMonth() === viewDate.getMonth()) {
            if (workerAgg[job.workerId]) workerAgg[job.workerId].completedCount++;
          }
        }
      });

      setSummaryData(Object.values(workerAgg).map((w: any) => ({
        ...w,
        activeDays: w.activeDays.size,
        acceptedCount: w.jobIds.size,
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

  // CSVダウンロード実行関数
  const handleExport = () => {
    if (summaryData.length === 0) {
      alert("データがありません。");
      return;
    }
    setExporting(true);
    console.log("CSV生成開始...");

    try {
      const headers = ["ワーカー名", "稼働日数", "案件請負数", "案件完了数", "稼働時間(h)"];
      
      const rows = summaryData.map(data => [
        `"${data.name}"`,
        data.activeDays,
        data.acceptedCount,
        data.completedCount,
        data.duration
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
        console.log("ダウンロード完了");
      }, 100);

    } catch (e) {
      console.error("Download Error:", e);
      alert("エラーが発生しました。コンソールを確認してください。");
      setExporting(false);
    }
  };

  return (
    <OwnerShell title="データ出力" subTitle="月次実績の確認とCSV出力">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 1. 操作パネル：丸みと古い紫色を廃止し、太枠線＋クリーンブルーのフラットボタンへ */}
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-black text-slate-500 whitespace-nowrap">対象月選択:</span>
            <input 
              type="month" 
              value={`${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => setViewDate(new Date(e.target.value))}
              className="text-xs font-black bg-white border-2 border-slate-300 rounded px-3 py-2 outline-none focus:border-[#0082C8] w-full sm:w-auto"
            />
          </div>
          
          <button 
            onClick={handleExport}
            disabled={exporting || summaryData.length === 0}
            className="w-full sm:w-auto bg-[#0082C8] hover:bg-[#0072B5] text-white border border-black/10 px-6 py-2.5 rounded text-xs font-black transition-colors disabled:opacity-30 flex items-center justify-center gap-1.5"
          >
            📥 {exporting ? "CSV生成中..." : "表示内容をCSVで出力する"}
          </button>
        </div>

        {/* 2. 実績プレビューテーブル：他の一覧表と完全にルールを統一 */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b-2 border-slate-300 bg-slate-100 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">実績プレビュー</h3>
            {loadingData && <span className="text-[11px] text-[#0082C8] font-black animate-pulse">リアルタイム集計中...</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead>
                {/* ヘッダー：グレーのベタ塗りとパキッとした文字サイズ */}
                <tr className="bg-slate-50 border-b border-slate-300 text-[11px] text-slate-500 font-black">
                  <th className="p-3 border-r border-slate-200">ワーカー名</th>
                  <th className="p-3 border-r border-slate-200 text-right w-28">稼働日数</th>
                  <th className="p-3 border-r border-slate-200 text-right w-28">案件請負数</th>
                  <th className="p-3 border-r border-slate-200 text-right w-28">案件完了数</th>
                  <th className="p-3 text-right w-32">総稼働時間</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800">
                {summaryData.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 border-r border-slate-200 font-bold text-slate-900">{row.name}</td>
                    <td className="p-3 border-r border-slate-200 text-right font-mono text-slate-600">{row.activeDays} 日</td>
                    <td className="p-3 border-r border-slate-200 text-right font-mono text-slate-600">{row.acceptedCount} 件</td>
                    <td className="p-3 border-r border-slate-200 text-right font-mono font-black text-emerald-600">{row.completedCount} 件</td>
                    <td className="p-3 text-right font-mono font-black text-[#0082C8] bg-slate-50/50">{row.duration} h</td>
                  </tr>
                ))}
                {!loadingData && summaryData.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-16 text-center text-slate-400 italic text-xs font-medium bg-slate-50">
                      選択された月の稼働データはありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </OwnerShell>
  );
}