"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where, deleteDoc, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
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
  const currentMonthStr = `${year}-${String(month + 1).padStart(2, "0")}`; // 例: "2026-06"

  // 当月の承認・確定ステータス管理用のステート
  const [monthlyStatus, setMonthlyStatus] = useState<string>("none"); 
  const [monthlyTotalSeconds, setMonthlyTotalSeconds] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // カスタムポップアップ（モーダル）用の管理ステート
  const [modalOpen, setModalOpen] = useState(false);

  // その月の全日付を生成
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

  const fetchLogsAndStatus = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const statusDocRef = doc(db, "workerMonthlyStatus", `${user.uid}_${currentMonthStr}`);
      const statusSnap = await getDoc(statusDocRef);
      if (statusSnap.exists()) {
        setMonthlyStatus(statusSnap.data().status || "none");
      } else {
        setMonthlyStatus("none");
      }

      const q = query(collection(db, "workLogs"), where("workerId", "==", user.uid));
      const snap = await getDocs(q);
      
      let monthTotalSec = 0;
      
      const logData = snap.docs.map(d => {
        const data = d.data() as any;
        const endTime = data.timestamp?.toDate() || new Date();
        const startTime = new Date(endTime.getTime() - (data.seconds || 0) * 1000);
        return {
          id: d.id,
          jobId: data.jobId || "",
          jobTitle: data.jobTitle || "無題の案件",
          seconds: Number(data.seconds || 0),
          startTime,
          endTime,
        };
      }).filter((log: any) => {
        const isMatch = log.startTime.getFullYear() === year && log.startTime.getMonth() === month;
        if (isMatch) {
          monthTotalSec += log.seconds;
        }
        return isMatch;
      });

      setLogs(logData);
      setMonthlyTotalSeconds(monthTotalSec);
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    if (!authLoading) fetchLogsAndStatus();
  }, [user, authLoading, viewDate]);

  const handleConfirmMonthSubmit = async () => {
    setModalOpen(false);
    if (!user || !currentMonthStr) return;

    setSubmitting(true);
    try {
      const statusDocRef = doc(db, "workerMonthlyStatus", `${user.uid}_${currentMonthStr}`);
      
      await setDoc(statusDocRef, {
        workerId: user.uid,
        workerName: user.displayName || user.email || "ワーカー",
        yearMonth: currentMonthStr,
        totalSeconds: monthlyTotalSeconds,
        status: "confirmed",
        confirmedAt: serverTimestamp()
      });

      setMonthlyStatus("confirmed");
      alert("今月の稼働実績を『確認済み』として確定ロックしました！");
    } catch (e) {
      console.error(e);
      alert("確定処理に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (monthlyStatus === "confirmed") {
      alert("今月の稼働は『確認済み』としてロックされているため、記録を削除できません。");
      return;
    }

    if (!confirm(`この稼働記録を削除しますか？\n※この操作は取り消せません。`)) return;
    try {
      await deleteDoc(doc(db, "workLogs", id));
      fetchLogsAndStatus();
    } catch (e) { 
      alert("削除に失敗しました"); 
    }
  };

  const changeMonth = (diff: number) => setViewDate(new Date(year, month + diff, 1));
  const formatHM = (date: Date) => date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  
  const formatTextTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}時間 ${m}分 ${sec}秒`;
  };

  const formatBadgeTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${sec}s`;
  };
  
  if (authLoading || loading) return <WorkerShell title="稼働履歴"><div className="p-10 text-center text-slate-400 text-xs font-bold">打刻データを集計中...</div></WorkerShell>;

  return (
    <WorkerShell title="稼働履歴" subTitle="日別稼働時間の明細一覧">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 月次稼働締めコントロールボード */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
          <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
            <span className="text-xs font-black text-slate-700">🌙 月次稼働締めコントロール</span>
            <span className="text-[10px] font-mono font-bold text-slate-400">MONTHLY CLOSING</span>
          </div>
          <div className="p-4 md:flex md:items-center md:justify-between gap-6 bg-blue-50/40">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                {year}年 {month + 1}月 / 表示月の合計稼働時間
              </span>
              <p className="text-xl font-black text-[#0082C8] font-mono tracking-tight">
                {formatTextTime(monthlyTotalSeconds)}
              </p>
            </div>
            
            <div className="mt-4 md:mt-0 flex flex-col sm:items-end gap-2 max-w-md">
              {monthlyStatus === "confirmed" ? (
                <div className="bg-emerald-50 text-emerald-700 border-2 border-emerald-300 text-xs font-black px-4 py-2.5 rounded text-center shadow-inner select-none whitespace-nowrap">
                  ✓ 今月の稼働実績は提出済みです
                </div>
              ) : (
                <>
                  <span className="text-[11px] font-bold text-slate-500 leading-tight">
                    📝 今月の業務時間の確認後、「稼働実績確認済み」を押して提出してください
                  </span>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)} 
                    disabled={submitting || monthlyTotalSeconds === 0}
                    className="w-full sm:w-auto bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-5 py-2.5 rounded border border-black/10 shadow-sm transition-all active:scale-95 disabled:opacity-30 whitespace-nowrap text-center"
                  >
                    🔒 稼働実績確認済みとして提出
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 1. 上部コントロールバー */}
        <div className="flex items-center justify-between bg-white border-2 border-slate-300 p-4 rounded shadow-sm">
          <button onClick={() => router.push("/worker/dashboard")} className="text-[11px] font-black text-[#0082C8] hover:underline">
            ← メインメニューに戻る
          </button>
          
          <div className="flex items-center bg-white border-2 border-slate-300 rounded overflow-hidden">
            <button onClick={() => changeMonth(-1)} className="px-3 py-1.5 hover:bg-slate-100 text-slate-700 font-bold text-xs border-r border-slate-300 transition-colors">〈</button>
            <span className="px-4 py-1.5 text-xs font-black text-slate-800 bg-slate-50">{year}年 {month + 1}月</span>
            <button onClick={() => changeMonth(1)} className="px-3 py-1.5 hover:bg-slate-100 text-slate-700 font-bold text-xs border-l border-slate-300 transition-colors">〉</button>
          </div>
        </div>

        {/* 2. タイムラインテーブル */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="grid grid-cols-[90px_1fr] bg-slate-100 border-b-2 border-slate-300 text-xs font-black text-slate-700 px-4 py-2.5">
            <div className="border-r border-slate-300">日付軸</div>
            <div className="pl-6">打刻明細 / 稼働内容</div>
          </div>

          <div className="divide-y-2 divide-slate-200">
            {calendarDays.map((date) => {
              const day = date.getDate();
              const weekDay = date.getDay();
              const isToday = new Date().toDateString() === date.toDateString();
              
              const dayLogs = logs.filter(l => 
                l.startTime.getDate() === day && 
                l.startTime.getMonth() === month && 
                l.startTime.getFullYear() === year
              );

              return (
                <div key={day} className={`grid grid-cols-[90px_1fr] min-h-[54px] transition-colors ${isToday ? "bg-blue-50/50" : "hover:bg-slate-50/40"}`}>
                  
                  <div className={`flex flex-col items-center justify-center border-r-2 border-slate-300 py-2 select-none ${
                    weekDay === 0 ? "text-rose-600 bg-rose-50/20" : weekDay === 6 ? "text-blue-600 bg-blue-50/20" : "text-slate-500"
                  }`}>
                    <span className="text-xs font-black font-mono tracking-tight leading-none">{String(day).padStart(2, '0')}</span>
                    <span className="text-[9px] font-black opacity-70 mt-1">{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][weekDay]}</span>
                  </div>

                  <div className="p-2 pl-6 flex flex-wrap gap-2 items-center min-w-0">
                    {dayLogs.length > 0 ? dayLogs.map((log: any) => (
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
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right border-l-2 border-slate-200 pl-2">
                            <span className="text-xs font-black text-[#0082C8] block font-mono whitespace-nowrap">
                              {formatBadgeTime(log.seconds)}
                            </span>
                          </div>
                          
                          {monthlyStatus !== "confirmed" && (
                            <button 
                              onClick={() => handleDelete(log.id)} 
                              className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                              title="この記録を削除"
                            >
                              <span className="text-xs block">🗑️</span>
                            </button>
                          )}
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

      {/* 💡【超シンプル化リフォーム】ダサい4重黒枠線と飛び出す影を全撤去！一般的なWebツール同様にやさしく洗練されたモダンモーダル */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          {/* border-4 border-slate-950 や shadow-rgba をすべて消し、丸み(rounded-lg)とやさしい極細線 border-slate-200 ＆ ふんわりした高級な下影 shadow-xl へお色直し */}
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            {/* ポップアップヘッダー：太帯感をなくし、スマートで知的なクリーンブルーの細帯へ */}
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>🔒 稼働実績の提出確認</span>
            </div>

            {/* ポップアップ本文：背景のグレー(bg-slate-50)を廃止し、すっきりした純白で視認性を最大化 */}
            <div className="p-6 bg-white">
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                今月の最終業務報告として、この稼働実績を『確認済み』にしますか？{"\n\n"}確定すると実績データがロックされ、オーナー側の管理画面へ共有されます。
              </p>
            </div>

            {/* アクションボタン：無駄な黒い境界線を全撤去、モダンなフラットデザインへ */}
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide"
              >
                いいえ
              </button>
              <button
                type="button"
                onClick={handleConfirmMonthSubmit}
                className="px-4 py-2 bg-[#0082C8] hover:bg-[#0072B5] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
              >
                はい、提出する
              </button>
            </div>

          </div>
        </div>
      )}

    </WorkerShell>
  );
}