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
    } catch (e) { console.error("Data fetch error", e); } finally { setLoadingData(false); }
  };

  useEffect(() => { if (!authLoading) fetchSummary(); }, [viewDate, user, authLoading]);

  // ★ CSVダウンロード実行関数
  const handleExport = () => {
    if (summaryData.length === 0) {
      alert("データがありません。");
      return;
    }
    setExporting(true);
    console.log("CSV生成開始...");

    try {
      // 1. ヘッダー行
      const headers = ["ワーカー名", "稼働日数", "案件請負数", "案件完了数", "稼働時間(h)"];
      
      // 2. データ行
      const rows = summaryData.map(data => [
        `"${data.name}"`,
        data.activeDays,
        data.acceptedCount,
        data.completedCount,
        data.duration
      ].join(","));

      // 3. 結合 (BOM付きUTF-8)
      const csvContent = "\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
      
      // 4. Blobの作成
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      
      // 5. ダウンロード実行
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${viewDate.getFullYear()}年${viewDate.getMonth() + 1}月実績レポート.csv`;
      
      document.body.appendChild(a);
      a.click();
      
      // 6. 後片付け
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
    <OwnerShell title="Data Export" subTitle="月次実績の確認と出力">
      <div className="max-w-5xl mx-auto space-y-6 pb-20 font-sans">
        
        {/* 月選択とダウンロードボタン */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <input 
              type="month" 
              value={`${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => setViewDate(new Date(e.target.value))}
              className="text-sm font-black bg-slate-50 border border-slate-100 rounded-lg px-4 py-2 outline-none"
            />
          </div>
          
          <button 
            onClick={handleExport}
            disabled={exporting || summaryData.length === 0}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-[11px] font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-30"
          >
            {exporting ? "CSV生成中..." : "表示内容をCSVでダウンロード"}
          </button>
        </div>

        {/* プレビュー一覧 */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Performance Preview / 実績プレビュー</h3>
            {loadingData && <span className="text-[10px] text-indigo-500 font-bold animate-pulse">集計中...</span>}
          </div>
          
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">ワーカー名</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">稼働日数</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">案件請負数</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">案件完了数</th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">稼働時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summaryData.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 text-[11px] font-bold text-slate-700">{row.name}</td>
                  <td className="px-6 py-4 text-[11px] text-right font-mono text-slate-500">{row.activeDays} 日</td>
                  <td className="px-6 py-4 text-[11px] text-right font-mono text-slate-500">{row.acceptedCount} 件</td>
                  <td className="px-6 py-4 text-[11px] text-right font-mono font-bold text-emerald-600">{row.completedCount} 件</td>
                  <td className="px-6 py-4 text-[11px] text-right font-mono font-bold text-indigo-600">{row.duration} h</td>
                </tr>
              ))}
              {!loadingData && summaryData.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-20 text-center text-slate-300 italic text-xs">稼働データがありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </OwnerShell>
  );
}