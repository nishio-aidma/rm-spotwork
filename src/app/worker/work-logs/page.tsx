"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import WorkerShell from "@/components/WorkerShell";
import { useRouter } from "next/navigation";

export default function WorkLogsPage() {
  const { user, loading: authLoading } = useRequireAuth("worker");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const router = useRouter();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // その月の全日付を生成
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

  const fetchLogs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, "workLogs"), where("workerId", "==", user.uid));
      const snap = await getDocs(q);
      const logData = snap.docs.map(d => {
        const data = d.data();
        const endTime = data.timestamp?.toDate() || new Date();
        const startTime = new Date(endTime.getTime() - (data.seconds || 0) * 1000);
        return {
          id: d.id,
          ...data,
          startTime,
          endTime,
          dateKey: startTime.getDate() // 日にちだけでマッチング
        };
      });
      setLogs(logData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    if (!authLoading) fetchLogs();
  }, [user, authLoading, viewDate]);

  const handleDelete = async (id: string) => {
    if (!confirm(`この稼働記録を削除しますか？`)) return;
    try {
      await deleteDoc(doc(db, "workLogs", id));
      fetchLogs();
    } catch (e) { alert("削除に失敗しました"); }
  };

  const changeMonth = (diff: number) => setViewDate(new Date(year, month + diff, 1));
  const formatHM = (date: Date) => date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  
  if (authLoading || loading) return <WorkerShell title="History"><div className="p-10 italic text-center text-slate-400">Loading history...</div></WorkerShell>;

  return (
    <WorkerShell title="History" subTitle="稼働明細">
      <div className="max-w-5xl mx-auto space-y-4 pb-20 font-sans">
        
        <div className="flex items-center justify-between">
          <button onClick={() => router.push("/worker/dashboard")} className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-all">← DASHBOARD</button>
          
          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <button onClick={() => changeMonth(-1)} className="px-3 py-1 hover:bg-slate-50 text-slate-400 text-xs border-r border-slate-100">〈</button>
            <span className="px-4 py-1 text-[11px] font-black text-slate-700 bg-slate-50/50">{year}年 {month + 1}月</span>
            <button onClick={() => changeMonth(1)} className="px-3 py-1 hover:bg-slate-50 text-slate-400 text-xs border-l border-slate-100">〉</button>
          </div>
        </div>

        {/* タイムラインテーブル */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[80px_1fr] bg-slate-50/80 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest px-4 py-2">
            <div>Date</div>
            <div className="pl-4">Work Sessions / 稼働内容</div>
          </div>

          <div className="divide-y divide-slate-100">
            {calendarDays.map((date) => {
              const day = date.getDate();
              const weekDay = date.getDay(); // 0:日, 6:土
              const isToday = new Date().toDateString() === date.toDateString();
              const dayLogs = logs.filter(l => l.dateKey === day && l.startTime.getMonth() === month);

              return (
                <div key={day} className={`grid grid-cols-[80px_1fr] min-h-[50px] transition-colors ${isToday ? "bg-indigo-50/30" : "hover:bg-slate-50/30"}`}>
                  {/* 左軸：日付 */}
                  <div className={`flex flex-col items-center justify-center border-r border-slate-100 py-2 ${
                    weekDay === 0 ? "text-rose-500" : weekDay === 6 ? "text-indigo-500" : "text-slate-500"
                  }`}>
                    <span className="text-xs font-black font-mono leading-none">{String(day).padStart(2, '0')}</span>
                    <span className="text-[8px] font-bold opacity-60 mt-1">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][weekDay]}</span>
                  </div>

                  {/* 右側：稼働内容 */}
                  <div className="p-2 pl-6 flex flex-wrap gap-2 items-center">
                    {dayLogs.length > 0 ? dayLogs.map((log) => (
                      <div key={log.id} className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 flex items-center gap-4 shadow-sm group hover:border-rose-200 transition-all">
                        <div>
                          <div className="text-[9px] font-black text-slate-400 truncate max-w-[120px] mb-0.5">{log.jobTitle}</div>
                          <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold text-slate-600">
                            <span>{formatHM(log.startTime)}</span>
                            <span className="text-slate-300">-</span>
                            <span>{formatHM(log.endTime)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right border-l border-slate-100 pl-3">
                            <span className="text-[10px] font-black text-indigo-600 block">{Math.floor(log.seconds / 60)}<span className="text-[8px] ml-0.5">m</span></span>
                          </div>
                          <button onClick={() => handleDelete(log.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all">
                            <span className="text-xs">🗑️</span>
                          </button>
                        </div>
                      </div>
                    )) : (
                      <span className="text-[10px] text-slate-200 italic font-medium">No activity</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </WorkerShell>
  );
}