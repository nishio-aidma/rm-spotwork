"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where, deleteDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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
  const [confirmModalOpen, setConfirmModalOpen] = useState(false); // 確定確認用
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);   // 削除確認用
  const [targetDeleteId, setTargetDeleteId] = useState<string | null>(null);

  // お知らせメッセージモーダル用ステート（Windowsのalert代替）
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalTitle, setInfoModalTitle] = useState("");
  const [infoModalMessage, setInfoModalMessage] = useState("");

  // その月の全日付を生成
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

  const showInfoModal = (title: string, message: string) => {
    setInfoModalTitle(title);
    setInfoModalMessage(message);
    setInfoModalOpen(true);
  };

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
          checked: data.checked || false,
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

  const handleToggleCheck = async (logId: string, currentChecked: boolean) => {
    if (monthlyStatus === "confirmed") return;

    try {
      const logRef = doc(db, "workLogs", logId);
      await updateDoc(logRef, {
        checked: !currentChecked,
        checkedAt: !currentChecked ? serverTimestamp() : null
      });

      setLogs(prev => prev.map(log => log.id === logId ? { ...log, checked: !currentChecked } : log));
    } catch (e) {
      console.error("チェック状態の更新に失敗しました:", e);
    }
  };

  const handleCheckAll = async () => {
    if (monthlyStatus === "confirmed" || logs.length === 0) return;

    const uncheckedLogs = logs.filter(log => !log.checked);
    if (uncheckedLogs.length === 0) return;

    setSubmitting(true);
    try {
      await Promise.all(
        uncheckedLogs.map(log => 
          updateDoc(doc(db, "workLogs", log.id), {
            checked: true,
            checkedAt: serverTimestamp()
          })
        )
      );

      setLogs(prev => prev.map(log => ({ ...log, checked: true })));
      showInfoModal("✅ 一括確認完了", `表示中の未確認データ（${uncheckedLogs.length}件）をすべて確認済みにしました！`);
    } catch (e) {
      console.error("一括確認エラー:", e);
      showInfoModal("⚠️ エラー", "一括確認処理に失敗しました。ネットワーク状況をご確認ください。");
    } finally {
      setSubmitting(false);
    }
  };

  // 💡【新機能】確定データから自動的にCSVを生成しパソコンへダウンロード保存する関数
  const generateAndDownloadCSV = () => {
    if (logs.length === 0) return;

    const headers = ["日付", "案件名", "開始時刻", "終了時刻", "稼働時間(秒)", "稼働時間", "確認ステータス"];
    
    const rows = logs.map(log => {
      const dateStr = log.startTime.toLocaleDateString('ja-JP');
      const startStr = formatHM(log.startTime);
      const endStr = formatHM(log.endTime);
      const statusStr = log.checked ? "確認済" : "未確認";
      
      const cleanTitle = (log.jobTitle || "無題の案件").replace(/"/g, '""');
      
      return [
        `"${dateStr}"`,
        `"${cleanTitle}"`,
        `"${startStr}"`,
        `"${endStr}"`,
        log.seconds,
        `"${formatBadgeTime(log.seconds)}"`,
        `"${statusStr}"`
      ].join(",");
    });

    // Excelで文字化けしないためのUTF-8 BOM付きCSVコンテンツを作成
    const csvString = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `稼働実績_${currentMonthStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleConfirmMonthSubmit = async () => {
    setConfirmModalOpen(false);
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

      // 💡【自動CSV出力の実行】
      generateAndDownloadCSV();

      showInfoModal("✨ 実績提出 ＆ CSV出力完了", "今月の稼働実績を『確認済み』として確定保存し、CSVファイルを出力しました！");
    } catch (e) {
      console.error(e);
      showInfoModal("⚠️ エラー", "確定処理に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  const triggerDeleteModal = (id: string) => {
    if (monthlyStatus === "confirmed") {
      showInfoModal("🔒 ロック中", "今月の稼働は『確認済み』としてロックされているため、記録を削除できません。");
      return;
    }
    setTargetDeleteId(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!targetDeleteId) return;
    setDeleteModalOpen(false);

    try {
      await deleteDoc(doc(db, "workLogs", targetDeleteId));
      fetchLogsAndStatus();
      showInfoModal("🗑️ 削除完了", "稼働記録を削除しました。");
    } catch (e) { 
      showInfoModal("⚠️ エラー", "削除に失敗しました。"); 
    } finally {
      setTargetDeleteId(null);
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
  
  if (authLoading || loading) return <WorkerShell title="稼働管理"><div className="p-10 text-center text-slate-400 text-xs font-bold">打刻データを集計中...</div></WorkerShell>;

  const hasUncheckedLogs = logs.some(log => !log.checked);

  return (
    <WorkerShell title="稼働管理" subTitle="日別稼働時間の明細一覧および月次確定デスク">
      <div className="max-w-full mx-auto flex flex-col h-[calc(100vh-140px)] text-slate-900 font-sans antialiased overflow-hidden">
        
        {/* 【上部エリア：完全固定コントロールボード】 */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden mb-3 shrink-0">
          
          <div className="bg-slate-100 p-2.5 border-b-2 border-slate-300 flex justify-between items-center select-none">
            <span className="text-xs font-black text-slate-700">🌙 月次稼働記録デスク</span>
            <span className="text-[10px] font-mono font-bold text-slate-400">MONTHLY RECORD</span>
          </div>

          <div className="p-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-blue-50/40">
            
            <div className="flex items-center gap-4 flex-wrap">
              <button 
                type="button"
                onClick={() => router.push("/worker/dashboard")} 
                className="text-[11px] font-black text-[#0082C8] hover:underline whitespace-nowrap shrink-0"
              >
                ← メインメニューに戻る
              </button>
              
              <div className="flex items-center bg-white border-2 border-slate-300 rounded overflow-hidden shadow-xs shrink-0">
                <button type="button" onClick={() => changeMonth(-1)} className="px-2.5 py-1 hover:bg-slate-100 text-slate-700 font-bold text-xs border-r border-slate-300 transition-colors">〈</button>
                <span className="px-3 py-1 text-xs font-black text-slate-800 bg-slate-50 whitespace-nowrap min-w-[90px] text-center">{year}年 {month + 1}月</span>
                <button type="button" onClick={() => changeMonth(1)} className="px-2.5 py-1 hover:bg-slate-100 text-slate-700 font-bold text-xs border-l border-slate-300 transition-colors">〉</button>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:justify-end flex-1 w-full">
              
              {/* 未確認データがある場合 */}
              {logs.length > 0 && hasUncheckedLogs && monthlyStatus !== "confirmed" && (
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <div className="bg-amber-100 border border-amber-300 text-amber-800 px-2.5 py-1 rounded text-[10px] font-black tracking-wide flex items-center gap-1 animate-pulse select-none">
                    ⚠️ 未確認の稼働があります
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckAll}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-3 py-1.5 rounded border border-black/10 shadow-sm transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap text-center cursor-pointer"
                  >
                    ✅ 全件確認済みにする
                  </button>
                </div>
              )}

              {/* すべてのデータが確認済み（かつ未提出）のとき */}
              {logs.length > 0 && !hasUncheckedLogs && monthlyStatus !== "confirmed" && (
                <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 px-2.5 py-1.5 rounded text-[10px] font-black tracking-wide flex items-center gap-1 shrink-0 select-none shadow-xs">
                  ✨ すべての稼働を確認済みです（提出可能です）
                </div>
              )}

              <div className="space-y-0.5 text-left sm:text-right shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  表示月の合計稼働時間
                </span>
                <p className="text-lg font-black text-[#0082C8] font-mono tracking-tight leading-none">
                  {formatTextTime(monthlyTotalSeconds)}
                </p>
              </div>
              
              <div className="flex shrink-0">
                {monthlyStatus === "confirmed" ? (
                  <div className="flex items-center gap-2">
                    <div className="bg-emerald-50 text-emerald-700 border-2 border-emerald-300 text-[10px] font-black px-3 py-2 rounded text-center shadow-inner select-none whitespace-nowrap">
                      ✓ 実績提出済み
                    </div>
                    <button
                      type="button"
                      onClick={generateAndDownloadCSV}
                      className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black px-3 py-2 rounded shadow-sm transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                      title="当月のCSVデータを再出力"
                    >
                      📥 CSV再出力
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(true)} 
                    disabled={submitting || monthlyTotalSeconds === 0 || hasUncheckedLogs}
                    className="w-full sm:w-auto bg-[#0082C8] hover:bg-[#0072B5] text-white text-[11px] font-black px-4 py-2 rounded border border-black/10 shadow-sm transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap text-center cursor-pointer"
                  >
                    🔒 確定して実績を提出（CSV自動出力）
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* 👥 【下部エリア：日次明細コンテナ】 */}
        <div className="bg-white border-2 border-slate-300 rounded shadow-sm flex flex-col min-h-0 flex-1 overflow-hidden">
          
          <div className="grid grid-cols-[90px_1fr] bg-slate-100 border-b-2 border-slate-300 text-xs font-black text-slate-700 px-4 py-2.5 shrink-0 select-none">
            <div className="border-r border-slate-300">日付軸</div>
            <div className="pl-6">打刻明細 / 稼働内容（※クリックで個別確認）</div>
          </div>

          <div className="divide-y-2 divide-slate-200 overflow-y-auto flex-1 bg-white">
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
                      <div 
                        key={log.id} 
                        onClick={() => handleToggleCheck(log.id, log.checked)}
                        className={`border rounded p-2 flex items-center gap-4 shadow-sm group transition-all max-w-full ${
                          monthlyStatus !== "confirmed" ? "cursor-pointer active:scale-95 select-none" : ""
                        } ${
                          log.checked 
                            ? 'bg-emerald-50/80 border-emerald-400 hover:border-emerald-500' 
                            : 'bg-white border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm text-white whitespace-nowrap leading-none ${
                              log.checked ? 'bg-emerald-600' : 'bg-amber-500 animate-pulse'
                            }`}>
                              {log.checked ? "✓ 確認済" : "⚠️ 未確認"}
                            </span>
                            <div className="text-[10px] font-black text-slate-500 truncate max-w-[140px]" title={log.jobTitle}>
                              {log.jobTitle}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[11px] font-bold text-slate-700">
                            <span>{formatHM(log.startTime)}</span>
                            <span className="text-slate-300 font-normal">-</span>
                            <span>{formatHM(log.endTime)}</span>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right border-l-2 border-slate-200 pl-2">
                            <span className={`text-xs font-black block font-mono whitespace-nowrap ${log.checked ? 'text-emerald-700' : 'text-[#0082C8]'}`}>
                              {formatBadgeTime(log.seconds)}
                            </span>
                          </div>
                          
                          {monthlyStatus !== "confirmed" && (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation(); 
                                triggerDeleteModal(log.id);
                              }} 
                              className="text-slate-300 hover:text-rose-600 transition-colors p-1 cursor-pointer"
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

      {/* 1. 稼働実績の提出確認モーダル */}
      {confirmModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>🔒 稼働実績の提出＆CSV保存確認</span>
            </div>

            <div className="p-6 bg-white space-y-2">
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                今月の稼働実績を『確認済み』として確定提出しますか？{"\n\n"}確定すると実績データがロックされ、同時に手元へCSVファイルが自動出力されます。
              </p>
            </div>

            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmMonthSubmit}
                className="px-4 py-2 bg-[#0082C8] hover:bg-[#0072B5] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm cursor-pointer"
              >
                はい、提出してCSV出力する
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 2. 稼働記録削除確認モーダル（Windows標準confirmの代替） */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            <div className="bg-rose-600 text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>⚠️ 稼働記録の削除</span>
            </div>

            <div className="p-6 bg-white">
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                この稼働記録を削除しますか？{"\n"}※この操作は取り消せません。
              </p>
            </div>

            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDeleteModalOpen(false); setTargetDeleteId(null); }}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm cursor-pointer"
              >
                削除する
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. お知らせ・完了メッセージモーダル（Windows標準alertの代替） */}
      {infoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
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
                className="px-5 py-2 bg-[#0082C8] hover:bg-[#0072B5] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm cursor-pointer"
              >
                OK
              </button>
            </div>

          </div>
        </div>
      )}

    </WorkerShell>
  );
}