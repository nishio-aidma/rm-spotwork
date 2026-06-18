"use client";

import { useEffect, useState } from "react";
import { collection, query, getDocs, where, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

export default function OwnerWorkManagementPage() {
  const { user: owner, loading: authLoading } = useRequireAuth("owner");
  
  // データ保管用ステート
  const [logs, setLogs] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // フィルター用ステート
  const [viewDate, setViewDate] = useState(new Date());
  const [workerFilter, setWorkerFilter] = useState<string>("all");

  // 新規・編集モーダル制御用ステート
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null); // nullなら新規登録、データがあれば編集
  const [submitting, setSubmitting] = useState(false);

  // フォーム入力用ステート
  const [formWorkerId, setFormWorkerId] = useState("");
  const [formJobTitle, setFormJobTitle] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formEndTime, setFormEndTime] = useState("18:00");
  const [formChecked, setFormChecked] = useState(false);

  const currentMonthStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;

  // 1. ワーカー一覧と、当月の全稼働ログを一括照合
  const fetchData = async () => {
    if (!owner) return;
    setLoading(true);
    try {
      // ワーカー名簿の取得
      const userSnap = await getDocs(query(collection(db, "users"), where("role", "==", "worker")));
      const workerList = userSnap.docs.map(d => ({
        id: d.id,
        name: `${d.data().lastName || ""} ${d.data().firstName || ""}`.trim() || d.data().name || "不明のスタッフ",
        email: d.data().email
      }));
      setWorkers(workerList);

      const workerMap = Object.fromEntries(workerList.map(w => [w.id, w.name]));

      // 稼働ログ（workLogs）の全取得
      const logSnap = await getDocs(collection(db, "workLogs"));
      
      const targetYear = viewDate.getFullYear();
      const targetMonth = viewDate.getMonth();

      const logList = logSnap.docs.map(d => {
        const data = d.data() as any;
        const endTime = data.timestamp?.toDate() || new Date();
        const startTime = new Date(endTime.getTime() - (data.seconds || 0) * 1000);
        
        return {
          id: d.id,
          workerId: data.workerId || "",
          workerName: workerMap[data.workerId] || "削除されたワーカー",
          jobId: data.jobId || "",
          jobTitle: data.jobTitle || "手動登録タスク",
          seconds: Number(data.seconds || 0),
          startTime,
          endTime,
          checked: data.checked || false,
        };
      }).filter(log => {
        // デフォルト当月でフィルター
        return log.startTime.getFullYear() === targetYear && log.startTime.getMonth() === targetMonth;
      });

      // 日付の昇順（1日〜末日）できれいに整列
      logList.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
      setLogs(logList);

    } catch (e) {
      console.error("データ取得失敗:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [owner, authLoading, viewDate]);

  // モーダルを開く（新規 or 編集）
  const openModal = (log: any = null) => {
    if (log) {
      setEditingLog(log);
      setFormWorkerId(log.workerId);
      setFormJobTitle(log.jobTitle);
      
      const yyyy = log.startTime.getFullYear();
      const mm = String(log.startTime.getMonth() + 1).padStart(2, "0");
      const dd = String(log.startTime.getDate()).padStart(2, "0");
      setFormDate(`${yyyy}-${mm}-${dd}`);
      
      setFormStartTime(log.startTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
      setFormEndTime(log.endTime.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
      setFormChecked(log.checked);
    } else {
      setEditingLog(null);
      setFormWorkerId(workers[0]?.id || "");
      setFormJobTitle("");
      
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setFormDate(`${yyyy}-${mm}-${dd}`);
      
      setFormStartTime("09:00");
      setFormEndTime("12:00");
      setFormChecked(true); // 管理者が入れる場合はデフォルト確認済みに
    }
    setModalOpen(true);
  };

  // フォームの保存（追加・編集のコミット）
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWorkerId || !formJobTitle || !formDate || !formStartTime || !formEndTime) {
      alert("すべての項目を正しく入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const startDateTime = new Date(`${formDate}T${formStartTime}:00`);
      const endDateTime = new Date(`${formDate}T${formEndTime}:00`);
      
      if (endDateTime.getTime() <= startDateTime.getTime()) {
        alert("終了時刻は開始時刻よりも後の時間を指定してください。");
        setSubmitting(false);
        return;
      }

      const calculatedSeconds = Math.floor((endDateTime.getTime() - startDateTime.getTime()) / 1000);

      const logPayload = {
        workerId: formWorkerId,
        jobTitle: formJobTitle,
        seconds: calculatedSeconds,
        timestamp: endDateTime,
        checked: formChecked,
        updatedAt: serverTimestamp()
      };

      if (editingLog) {
        await updateDoc(doc(db, "workLogs", editingLog.id), logPayload);
        alert("稼働記録を修正・更新しました。");
      } else {
        await addDoc(collection(db, "workLogs"), {
          ...logPayload,
          jobId: "manual_entry",
          createdAt: serverTimestamp()
        });
        alert("稼働記録を手動で新規登録しました。");
      }

      setModalOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("保存処理に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  // 稼働ログの削除
  const handleDeleteLog = async (logId: string) => {
    if (!confirm("【警告】この稼働明細ログを完全に削除しますか？\n※この操作は取り消せません。")) return;
    try {
      await deleteDoc(doc(db, "workLogs", logId));
      fetchData();
    } catch (e) {
      alert("削除に失敗しました。");
    }
  };

  // 時間フォーマット用ヘルパー
  const formatTextTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };
  const formatHM = (d: Date) => d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const filteredLogs = logs.filter(log => workerFilter === "all" || log.workerId === workerFilter);

  if (authLoading || loading) return <OwnerShell title="稼働管理"><div className="p-10 text-center text-slate-400 text-xs font-bold">稼働データを解析中...</div></OwnerShell>;

  return (
    <OwnerShell title="稼働管理" subTitle="スタッフ稼働セッションの監視・編集・手動追加マスター">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 1. 上部コンソール */}
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 whitespace-nowrap">対象月:</span>
              <input 
                type="month" 
                value={currentMonthStr}
                onChange={(e) => setViewDate(new Date(e.target.value))}
                className="text-xs font-black bg-white border-2 border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-[#0082C8]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-500 whitespace-nowrap">スタッフ絞り込み:</span>
              <select
                value={workerFilter}
                onChange={(e) => setWorkerFilter(e.target.value)}
                className="text-xs font-black bg-white border-2 border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-[#0082C8] min-w-[160px]"
              >
                <option value="all">👥 全員の稼働を表示 ({logs.length}件)</option>
                {workers.map(w => (
                  <option key={w.id} value={w.id}>👤 {w.name}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => openModal()}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border border-black/10 px-5 py-2 rounded text-xs font-black transition-colors shadow-sm flex items-center justify-center gap-1.5 self-end md:self-auto"
          >
            ➕ 稼働記録を手動追加する
          </button>
        </div>

        {/* 2. メインテーブル */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[900px]">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-300 text-[11px] text-slate-600 font-black">
                  <th className="p-3 border-r border-slate-200 w-28 text-center">稼働日付</th>
                  <th className="p-3 border-r border-slate-200 w-44">スタッフ名</th>
                  <th className="p-3 border-r border-slate-200">従事した案件・タスク名</th>
                  <th className="p-3 border-r border-slate-200 w-56 text-center">稼働時間（タイムスタンプ）</th>
                  <th className="p-3 border-r border-slate-200 w-28 text-center">合計時間</th>
                  <th className="p-3 border-r border-slate-200 w-28 text-center">本人確認</th>
                  <th className="p-3 w-28 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 border-r border-slate-200 font-mono text-center text-slate-500 font-bold">
                      {log.startTime.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" })}
                    </td>
                    <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate" title={log.workerName}>
                      {log.workerName}
                    </td>
                    <td className="p-3 border-r border-slate-200 font-bold text-slate-700 truncate" title={log.jobTitle}>
                      {log.jobTitle}
                    </td>
                    <td className="p-3 border-r border-slate-200 font-mono text-center text-slate-600">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">{formatHM(log.startTime)}</span>
                      <span className="mx-1 text-slate-300">-</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">{formatHM(log.endTime)}</span>
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center font-mono font-black text-[#0082C8] bg-slate-50/40">
                      {formatTextTime(log.seconds)}
                    </td>
                    <td className="p-3 border-r border-slate-200 text-center">
                      {log.checked ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-black px-2 py-0.5 rounded">確認済</span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 border border-amber-300 text-[10px] font-black px-2 py-0.5 rounded">未確認</span>
                      )}
                    </td>
                    <td className="p-3 text-center flex items-center justify-center gap-3 select-none">
                      <button 
                        type="button" 
                        onClick={() => openModal(log)} 
                        className="text-[#0082C8] hover:underline font-black text-[11px]"
                      >
                        編集
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteLog(log.id)} 
                        className="text-slate-300 hover:text-rose-600 transition-colors p-1 text-[13px]"
                        title="削除"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-16 text-center text-slate-400 italic text-xs font-medium bg-slate-50">
                      該当する稼働ログは登録されていません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* 新規登録 ＆ 編集用モーダル */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <form onSubmit={handleSaveForm} className="bg-white border border-slate-200 w-full max-w-md rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>{editingLog ? "📝 稼働記録を修正・編集" : "➕ 稼働記録の手動追加・新規登録"}</span>
            </div>

            <div className="p-5 bg-white space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1">
                <label className="text-slate-400 block uppercase tracking-wider text-[10px]">対象スタッフ</label>
                <select
                  disabled={!!editingLog}
                  value={formWorkerId}
                  onChange={(e) => setFormWorkerId(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded p-2 outline-none focus:border-[#0082C8] disabled:bg-slate-100 disabled:text-slate-500 font-black"
                >
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.email})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block uppercase tracking-wider text-[10px]">従事した案件・タスク名称</label>
                <input
                  type="text"
                  placeholder="例: 【フォーム投稿】全国の学習塾リスト 100件"
                  value={formJobTitle}
                  onChange={(e) => setFormJobTitle(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded p-2 outline-none focus:border-[#0082C8] font-black placeholder:font-normal"
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block uppercase tracking-wider text-[10px]">稼働実施日</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded p-2 outline-none focus:border-[#0082C8] font-mono font-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block uppercase tracking-wider text-[10px]">開始時刻 (打刻イン)</label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded p-2 outline-none focus:border-[#0082C8] font-mono font-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 block uppercase tracking-wider text-[10px]">終了時刻 (打刻アウト)</label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full border-2 border-slate-300 rounded p-2 outline-none focus:border-[#0082C8] font-mono font-black"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <span className="text-[11px] text-slate-500">この記録を「本人確認済み」にする</span>
                <input
                  type="checkbox"
                  checked={formChecked}
                  onChange={(e) => setFormChecked(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2 select-none">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#0082C8] hover:bg-[#0072B5] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm disabled:opacity-50"
              >
                {submitting ? "保存中..." : "この内容で確定・保存"}
              </button>
            </div>
          </form>
        </div>
      )}
    {/* 💡 最後の閉じタグを WorkerShell から OwnerShell へ確実に修正！ */}
    </OwnerShell>
  );
}