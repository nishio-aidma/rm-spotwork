"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, orderBy, where, doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [viewDate, setViewDate] = useState(new Date()); // 出力対象月
  const [stats, setStats] = useState({ totalJobs: 0, activeJobs: 0, reviewJobs: 0, totalSeconds: 0 });
  const [workerStats, setWorkerStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      try {
        const jSnap = await getDocs(query(collection(db, "jobs"), orderBy("createdAt", "desc")));
        const allJobs = jSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const uSnap = await getDocs(query(collection(db, "users"), where("role", "==", "worker")));
        const userMap: any = {};
        uSnap.docs.forEach(d => {
          const u = d.data();
          userMap[d.id] = `${u.lastName || ""} ${u.firstName || ""}`.trim() || u.name || "不明";
        });

        let totalSec = 0, active = 0, review = 0;
        const workerAgg: any = {};

        allJobs.forEach((j: any) => {
          if (j.status === "working" || j.status === "paused") active++;
          if (j.status === "review") review++;
          if (j.status === "completed") totalSec += (j.totalAccumulatedSeconds || 0);

          if (j.workerId) {
            if (!workerAgg[j.workerId]) {
              workerAgg[j.workerId] = { name: userMap[j.workerId], total: 0, working: 0, workingSec: 0, review: 0, completed: 0, completedSec: 0 };
            }
            const w = workerAgg[j.workerId];
            w.total++;
            if (j.status === "working" || j.status === "paused") { w.working++; w.workingSec += (j.totalAccumulatedSeconds || 0); }
            else if (j.status === "review") { w.review++; w.workingSec += (j.totalAccumulatedSeconds || 0); }
            else if (j.status === "completed") { w.completed++; w.completedSec += (j.totalAccumulatedSeconds || 0); }
          }
        });

        setStats({ totalJobs: allJobs.length, activeJobs: active, reviewJobs: review, totalSeconds: totalSec });
        setWorkerStats(Object.values(workerAgg).sort((a: any, b: any) => b.total - a.total));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    if (!authLoading) fetchData();
  }, [user, authLoading]);

  // ★ CSVエクスポート・メインエンジン
  const exportMonthlyCSV = async () => {
    setExporting(true);
    try {
      // 1. テンプレート設定の取得
      const tSnap = await getDoc(doc(db, "settings", "csv_template"));
      const template = tSnap.exists() ? tSnap.data().fields : [];
      const enabledFields = template.filter((f: any) => f.enabled);
      
      if (enabledFields.length === 0) {
        alert("出力設定が有効になっていません。設定画面を確認してください。");
        return;
      }

      // 2. 指定月の稼働ログを取得
      const startOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
      const endOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0, 23, 59, 59);
      
      const [logSnap, jobSnap, userSnap] = await Promise.all([
        getDocs(query(collection(db, "workLogs"), where("timestamp", ">=", Timestamp.fromDate(startOfMonth)), where("timestamp", "<=", Timestamp.fromDate(endOfMonth)))),
        getDocs(collection(db, "jobs")),
        getDocs(query(collection(db, "users"), where("role", "==", "worker")))
      ]);

      const jobsMap = Object.fromEntries(jobSnap.docs.map(d => [d.id, d.data()]));
      const userMap = Object.fromEntries(userSnap.docs.map(d => [d.id, `${d.data().lastName || ""} ${d.data().firstName || ""}`.trim()]));

      // 3. データの集約 (Worker + Job 単位)
      const aggregation: any = {};
      logSnap.docs.forEach(d => {
        const log = d.data();
        const key = `${log.workerId}_${log.jobId}`;
        if (!aggregation[key]) {
          const job = jobsMap[log.jobId] || {};
          aggregation[key] = {
            workerName: userMap[log.workerId] || "不明",
            jobTitle: log.jobTitle || job.title || "不明",
            jobType: job.jobType === 'form_posting' ? 'フォーム投稿' : 'リスト作成',
            durationHours: 0,
            workCount: job.status === 'completed' ? 1 : 0, // 月内に完了したかどうかの判定（簡易版）
            completedAt: job.completedAt ? job.completedAt.toDate().toLocaleDateString() : "-",
            status: job.status || "不明",
            seconds: 0
          };
        }
        aggregation[key].seconds += log.seconds;
      });

      // 4. CSV文字列の生成
      const headers = enabledFields.map((f: any) => f.defaultHeader).join(",");
      const rows = Object.values(aggregation).map((data: any) => {
        data.durationHours = (data.seconds / 3600).toFixed(2); // 小数点2位で時間換算
        return enabledFields.map((f: any) => `"${data[f.id] || ""}"`).join(",");
      });

      const csvContent = "\uFEFF" + [headers, ...rows].join("\n"); // BOM付きUTF-8
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `payment_report_${viewDate.getFullYear()}_${viewDate.getMonth() + 1}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (e) {
      console.error(e);
      alert("CSVの生成中にエラーが発生しました。");
    } finally {
      setExporting(false);
    }
  };

  if (authLoading || loading) return <OwnerShell title="Dashboard"><div className="p-10 italic text-slate-400">Loading Analytics...</div></OwnerShell>;

  return (
    <OwnerShell title="Analytics" subTitle="稼働状況とデータ出力">
      <div className="space-y-8 font-sans text-slate-900">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="検収待ち" value={stats.reviewJobs} unit="件" isAlert={stats.reviewJobs > 0} />
          <StatCard label="進行中の案件" value={stats.activeJobs} unit="件" />
          <StatCard label="総稼働時間 (完了)" value={formatTime(stats.totalSeconds)} />
          <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-100 flex flex-col justify-between">
            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-200">月次レポート出力</span>
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="month" 
                value={`${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`}
                onChange={(e) => setViewDate(new Date(e.target.value))}
                className="bg-indigo-500 text-white text-[11px] font-bold p-1 rounded outline-none border-none"
              />
              <button 
                onClick={exportMonthlyCSV}
                disabled={exporting}
                className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-[10px] font-black hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                {exporting ? "作成中..." : "CSV出力"}
              </button>
            </div>
          </div>
        </div>

        {/* ワーカー統計テーブル */}
        <section>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Worker Performance</h3>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest w-40">Worker</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-20">請負数</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">進行中 (件 / 時間)</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">検収中 (件)</th>
                  <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">完了 (件 / 時間)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {workerStats.map((ws, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700 truncate">{ws.name}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-500">{ws.total}</td>
                    <td className="px-6 py-4 text-right font-bold text-indigo-600">{ws.working}件 / <span className="text-slate-400 font-mono text-[10px]">{formatTime(ws.workingSec)}</span></td>
                    <td className="px-6 py-4 text-right font-bold text-rose-500">{ws.review}件</td>
                    <td className="px-6 py-4 text-right font-bold text-slate-800">{ws.completed}件 / <span className="text-slate-400 font-mono text-[10px]">{formatTime(ws.completedSec)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ShortcutButton href="/owner/jobs/new" icon="📝" label="新規案件を作成" />
          <ShortcutButton href="/owner/jobs" icon="🗂️" label="案件一覧・検収" />
        </div>
      </div>
    </OwnerShell>
  );
}

const StatCard = ({ label, value, unit, isAlert }: any) => (
  <div className={`bg-white p-6 rounded-2xl border transition-all shadow-sm ${isAlert ? "border-rose-200 ring-4 ring-rose-50/50" : "border-slate-100"}`}>
    <span className={`text-[9px] font-black uppercase tracking-widest mb-1 block ${isAlert ? "text-rose-500" : "text-slate-400"}`}>{label}</span>
    <div className="flex items-baseline gap-1">
      <span className={`text-2xl font-black tracking-tight ${isAlert ? "text-rose-600" : "text-slate-800"}`}>{value}</span>
      {unit && <span className="text-[10px] font-bold text-slate-400">{unit}</span>}
    </div>
  </div>
);

const ShortcutButton = ({ href, icon, label }: any) => (
  <Link href={href} className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all group">
    <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
    <span className="text-[11px] font-bold text-slate-600 group-hover:text-indigo-600">{label}</span>
  </Link>
);