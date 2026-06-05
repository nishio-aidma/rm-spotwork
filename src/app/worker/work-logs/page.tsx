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
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    if (!authLoading) fetchLogs();
  }, [user, authLoading, viewDate]);

  const handleDelete = async (id: string) => {
    if (!confirm(`この稼働記録を削除しますか？\n※この操作は取り消せません。`)) return;
    try {
      await deleteDoc(doc(db, "workLogs", id));
      fetchLogs();
    } catch (e) { 
      alert("削除に失敗しました"); 
    }
  };

  const changeMonth = (diff: number) => setViewDate(new Date(year, month + diff, 1));
  const formatHM = (date: Date) => date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  
  if (authLoading || loading) return <WorkerShell title="稼働履歴"><div className="p-10 text-center text-slate-400 text-xs font-bold">打刻データを集計中...</div></WorkerShell>;

  return (
    <WorkerShell title="稼働履歴" subTitle="日別稼働時間の明細一覧">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 1. 上部コントロールバー：太枠セパレート ＆ クリーンブルー動線 */}
        <div className="flex items-center justify-between bg-white border-2 border-slate-300 p-4 rounded shadow-sm">
          <button onClick={() => router.push("/worker/dashboard")} className="text-[11px] font-black text-[#0082C8] hover:underline">
            ← メインメニューに戻る
          </button>
          
          {/* 月次セレクター：パキッとした太枠ボタン構成へ */}
          <div className="flex items-center bg-white border-2 border-slate-300 rounded overflow-hidden">
            <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 hover:bg-slate-100 text-slate-700 font-bold text-xs border-r border-slate-300 transition-colors">〈</button>
            <span className="px-4 py-1.5 text-xs font-black text-slate-800 bg-slate-50">{year}年 {month + 1}月</span>
            <button onClick={() => changeMonth(1)} className="px-3 py-1.5 hover:bg-slate-100 text-slate-700 font-bold text-xs border-l border-slate-300 transition-colors">〉</button>
          </div>
        </div>

        {/* 2. タイムラインテーブル：工場やレジの稼働表のようにカチッと格子状（網の目）に仕切る */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          {/* 表ヘッダー：太線セパレート */}
          <div className="grid grid-cols-[90px_1fr] bg-slate-100 border-b-2 border-slate-300 text-xs font-black text-slate-700 px-4 py-2.5">
            <div className="border-r border-slate-300">日付軸</div>
            <div className="pl-6">打刻明細 / 稼働内容</div>
          </div>

          {/* カレンダー行のスタック */}
          <div className="divide-y-2 divide-slate-200">
            {calendarDays.map((date) => {
              const day = date.getDate();
              const weekDay = date.getDay(); // 0:日, 6:土
              const isToday = new Date().toDateString() === date.toDateString();
              const dayLogs = logs.filter(l => l.dateKey === day && l.startTime.getMonth() === month);

              return (
                /* 今日の行のハイライトを、ぼやけた紫から、現場ルールに則った淡いブルー（bg-blue-50/50）へ */
                <div key={day} className={`grid grid-cols-[90px_1fr] min-h-[54px] transition-colors ${isToday ? "bg-blue-50/50" : "hover:bg-slate-50/40"}`}>
                  
                  {/* 左軸（日付）：太線の縦線（border-r-2）でパキッとセパレート */}
                  <div className={`flex flex-col items-center justify-center border-r-2 border-slate-300 py-2 select-none ${
                    weekDay === 0 ? "text-rose-600 bg-rose-50/20" : weekDay === 6 ? "text-blue-600 bg-blue-50/20" : "text-slate-500"
                  }`}>
                    <span className="text-xs font-black font-mono tracking-tight leading-none">{String(day).padStart(2, '0')}</span>
                    <span className="text-[9px] font-black opacity-70 mt-1">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][weekDay]}</span>
                  </div>

                  {/* 右側：その日の稼働バッジリスト */}
                  <div className="p-2 pl-6 flex flex-wrap gap-2 items-center min-w-0">
                    {dayLogs.length > 0 ? dayLogs.map((log) => (
                      /* 稼働カード：丸みを削り、細い線（border-slate-300）できっちりマス目化 */
                      <div key={log.id} className="bg-white border border-slate-300 rounded p-2 flex items-center gap-4 shadow-sm group hover:border-slate-400 transition-colors max-w-full">
                        <div className="min-w-0">
                          <div className="text-[10px] font-black text-slate-400 truncate max-w-[140px] mb-0.5" title={log.jobTitle}>
                            {log.jobTitle}
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700">
                            <span>{formatHM(log.startTime)}</span>
                            <span className="text-slate-300 font-normal">-</span>
                            <span>{formatHM(log.endTime)}</span>
                          </div>
                        </div>
                        
                        {/* 実績時間バッジ ＆ 削除アクション */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right border-l-2 border-slate-200 pl-2">
                            {/* 稼働時間のテキスト色を統一テーマのクリーンブルーへ */}
                            <span className="text-xs font-black text-[#0082C8] block font-mono">
                              {Math.floor(log.seconds / 60)}<span className="text-[9px] font-bold ml-0.5">m</span>
                            </span>
                          </div>
                          {/* 現場での誤操作防止のため、ゴミ箱は薄く表示しておきホバーでパキッと赤く */}
                          <button 
                            onClick={() => handleDelete(log.id)} 
                            className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                            title="この記録を削除"
                          >
                            <span className="text-xs block">🗑️</span>
                          </button>
                        </div>
                      </div>
                    )) : (
                      <span className="text-[10px] text-slate-300 italic font-bold tracking-wider uppercase select-none">No activity</span>
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