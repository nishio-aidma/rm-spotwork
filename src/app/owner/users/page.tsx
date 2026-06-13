"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerWorkersPage() {
  const { user: owner, loading: authLoading } = useRequireAuth("owner");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 大分類タブを管理するステート ('directory': 登録状況 / 'calendar': カレンダー状況)
  const [activeTab, setActiveTab] = useState<'directory' | 'calendar'>('directory');

  // 表示する「基準月」を管理する日付オブジェクト
  const [viewDate, setViewDate] = useState<Date>(new Date());

  // 本物のGoogleカレンダーから吸い上げたリアルタイム予定を保管するステート
  const [realCalendarEvents, setRealCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // 選択された基準月（viewDate）の「1日」から「末日」までの全日付を配列として動的に自動生成
  const getDaysInMonthArray = (targetDate: Date) => {
    const days = [];
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth(); // 0-11
    
    const totalDays = new Date(year, month + 1, 0).getDate();
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const label = `${month + 1}/${i}(${weekdays[d.getDay()]})`;
      const isToday = ymd === todayStr;
      
      days.push({ ymd, label, isToday });
    }
    return days;
  };

  const daysRange = getDaysInMonthArray(viewDate);

  const changeMonth = (diff: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + diff, 1));
  };

  const fetchAllUsers = async () => {
    if (!owner) return;
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const userList = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      
      userList.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      setUsers(userList);
    } catch (e) {
      console.error("Error fetching users:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGoogleCalendarSchedules = async (workerList: any[], targetDate: Date) => {
    if (workerList.length === 0) return;
    setCalendarLoading(true);
    try {
      const emails = workerList.map(w => w.email).filter(Boolean);
      
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth();
      const totalDays = new Date(year, month + 1, 0).getDate();

      const timeMin = new Date(`${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00+09:00`);
      const timeMax = new Date(`${year}-${String(month + 1).padStart(2, "0")}-${String(totalDays).padStart(2, "0")}T23:59:59+09:00`);

      const response = await fetch("/api/owner/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRealCalendarEvents(data.events || []);
      }
    } catch (err) {
      console.error("Googleカレンダーの自動一括同期に失敗しました:", err);
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchAllUsers();
  }, [owner, authLoading]);

  useEffect(() => {
    if (activeTab === 'calendar' && users.length > 0) {
      const currentWorkers = users.filter((u: any) => u.role !== 'owner');
      fetchGoogleCalendarSchedules(currentWorkers, viewDate);
    }
  }, [activeTab, users, viewDate]);

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (userId === auth.currentUser?.uid) {
      alert("現在ログイン中のご自身のアカウントは削除できません。");
      return;
    }

    const ok = window.confirm(`【警告】このスタッフアカウントを完全に削除しますか？\n\n対象：${userName}\n※この操作は取り消せません。`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(prev => prev.filter(u => u.id !== userId));
      alert("アカウントを完全に削除しました。");
    } catch (e) {
      console.error(e);
      alert("削除処理に失敗しました。");
    }
  };

  if (authLoading || loading) return <OwnerShell title="アカウント管理"><div className="p-10 text-center text-slate-400 text-xs font-bold">アカウント台帳を照合中...</div></OwnerShell>;

  const owners = users.filter((u: any) => u.role === 'owner');
  const workers = users.filter((u: any) => u.role !== 'owner');

  return (
    <OwnerShell title="アカウント管理" subTitle="登録スタッフ（オーナー／ワーカー）の登録状況一覧">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 1. 上部カウンターパネル ＆ タブコントロール */}
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div className="text-sm font-black text-slate-700 min-w-[120px]">
              登録総アカウント数: <span className="text-lg text-[#0082C8] font-black">{users.length}</span> 名
            </div>

            <div className="flex bg-slate-100 p-1 rounded border border-slate-300 gap-1 select-none">
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className={`px-4 py-1.5 rounded text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'directory'
                    ? 'bg-[#0082C8] text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                👤 登録状況一覧
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-1.5 rounded text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'calendar'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                📅 カレンダー状況
                <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm animate-pulse">RM業務</span>
              </button>
            </div>
          </div>

          <Link 
            href="/owner/users/new"
            className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded border border-black/10 transition-colors shadow-sm text-center whitespace-nowrap self-start sm:self-auto"
          >
            ➕ 新規スタッフを登録する
          </Link>
        </div>

        {/* 📂 タブ分岐1：【登録状況一覧】 */}
        {activeTab === 'directory' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* 管理者アカウント台帳 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-black px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-300 rounded uppercase">OWNER DIRECTORY</span>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">管理者アカウント台帳 ({owners.length}名)</h3>
              </div>
              
              <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                    <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs text-slate-700 font-black">
                      <tr>
                        <th className="p-3 border-r border-slate-300 w-28 text-center">権限区分</th>
                        <th className="p-3 border-r border-slate-300 w-48">スタッフ氏名</th>
                        <th className="p-3 border-r border-slate-300">連絡先（メールアドレス）</th>
                        <th className="p-3 border-r border-slate-300 w-44">システム登録日</th>
                        <th className="p-3 w-28 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
                      {owners.map((u) => {
                        const fullName = `${u.lastName || ""} ${u.firstName || u.name || "不明"}`;
                        const isMe = u.id === auth.currentUser?.uid;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 border-r border-slate-200">
                              <span className="bg-rose-50 text-rose-700 border border-rose-300 px-2 py-0.5 text-[10px] font-black rounded block text-center uppercase">オーナー</span>
                            </td>
                            <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate" title={fullName}>
                              {fullName} {isMe && <span className="text-[10px] text-slate-400 font-normal">（あなた）</span>}
                            </td>
                            <td className="p-3 border-r border-slate-200 text-slate-600 font-mono truncate" title={u.email}>{u.email}</td>
                            <td className="p-3 border-r border-slate-200 text-slate-500 truncate">{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : "-"}</td>
                            <td className="p-3 text-center flex items-center justify-center gap-3">
                              <Link href={`/owner/users/${u.id}`} className="text-[#0082C8] hover:underline font-black text-[11px]">詳細 →</Link>
                              {!isMe ? (
                                <button onClick={() => handleDeleteUser(u.id, fullName)} className="text-slate-300 hover:text-rose-600 transition-colors p-1" title="削除">🗑️</button>
                              ) : <div className="w-5" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ワーカーアカウント台帳 */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-black px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-300 rounded uppercase">WORKER DIRECTORY</span>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">作業者アカウント台帳 ({workers.length}名)</h3>
              </div>

              <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                    <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs text-slate-700 font-black">
                      <tr>
                        <th className="p-3 border-r border-slate-300 w-28 text-center">権限区分</th>
                        <th className="p-3 border-r border-slate-300 w-48">スタッフ氏名</th>
                        <th className="p-3 border-r border-slate-300">連絡先（メールアドレス）</th>
                        <th className="p-3 border-r border-slate-300 w-44">システム登録日</th>
                        <th className="p-3 w-28 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
                      {workers.map((u) => {
                        const fullName = `${u.lastName || ""} ${u.firstName || u.name || "不明"}`;
                        return (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 border-r border-slate-200">
                              <span className="bg-blue-50 text-blue-700 border border-blue-300 px-2 py-0.5 text-[10px] font-black rounded block text-center uppercase">ワーカー</span>
                            </td>
                            <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate" title={fullName}>{fullName}</td>
                            <td className="p-3 border-r border-slate-200 text-slate-600 font-mono truncate" title={u.email}>{u.email}</td>
                            <td className="p-3 border-r border-slate-200 text-slate-500 truncate">{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : "-"}</td>
                            <td className="p-3 text-center flex items-center justify-center gap-3">
                              <Link href={`/owner/users/${u.id}`} className="text-[#0082C8] hover:underline font-black text-[11px]">詳細 →</Link>
                              <button onClick={() => handleDeleteUser(u.id, fullName)} className="text-slate-300 hover:text-rose-600 transition-colors p-1" title="削除">🗑️</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {workers.length === 0 && (
                  <div className="p-10 text-center text-slate-400 italic font-medium bg-slate-50">登録されているワーカーはまだいません。</div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* 📅 タブ分岐2：【カレンダー状況】 */}
        {activeTab === 'calendar' && (
          <div className="space-y-3 animate-fade-in">
            
            <div className="bg-slate-900 text-white p-3 rounded border border-slate-800 flex justify-between items-center shadow-sm select-none">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => changeMonth(-1)} 
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-white font-black transition-colors"
                >
                  〈
                </button>
                <h4 className="text-sm font-black tracking-wide text-slate-100 mx-2">
                  📊 {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月度 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">の稼働シフト台帳</span>
                </h4>
                <button 
                  onClick={() => changeMonth(1)} 
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-white font-black transition-colors"
                >
                  〉
                </button>
              </div>
              
              <button
                type="button"
                onClick={() => setViewDate(new Date())}
                className="text-[11px] font-black text-[#0082C8] hover:underline uppercase tracking-tight"
              >
                今月（当月）へ戻る
              </button>
            </div>

            <div className="flex items-center justify-between px-1 flex-wrap gap-2 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-300 rounded uppercase">SHIFT MONITOR</span>
                <h3 className="text-xs font-black text-slate-500 tracking-wider">ワーカー並列タイムライン</h3>
              </div>
              {calendarLoading && (
                <span className="text-[11px] font-bold text-[#0082C8] animate-pulse">
                  🔄 Googleカレンダーから {viewDate.getMonth() + 1}月度のデータをリアルタイム同期中...
                </span>
              )}
            </div>

            <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed min-w-[3000px]">
                  
                  <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs text-slate-700 font-black">
                    <tr>
                      <th className="p-3 border-r border-slate-300 w-44 bg-slate-100 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">スタッフ氏名</th>
                      {daysRange.map((day) => (
                        <th 
                          key={day.ymd} 
                          className={`p-3 border-r border-slate-300 text-center font-mono w-24 ${
                            day.isToday ? 'bg-blue-50/80 text-[#0082C8] font-black' : ''
                          }`}
                        >
                          {day.label}
                          {day.isToday && <span className="text-[9px] bg-[#0082C8] text-white px-1 rounded ml-1 block sm:inline-block font-sans uppercase">本日</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
                    {workers.map((worker) => {
                      const fullName = `${worker.lastName || ""} ${worker.firstName || worker.name || "不明"}`;
                      
                      return (
                        <tr key={worker.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 border-r border-slate-200 font-bold text-slate-900 bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <div className="truncate" title={fullName}>{fullName}</div>
                            <div className="text-[9px] text-slate-400 font-mono font-normal truncate mt-0.5">{worker.email}</div>
                          </td>

                          {daysRange.map((day) => {
                            const matchedEvents = realCalendarEvents.filter(
                              (ev) => ev.workerEmail === worker.email && ev.date === day.ymd
                            );

                            return (
                              <td 
                                key={day.ymd} 
                                className={`p-2 border-r border-slate-200 text-center transition-all ${
                                  day.isToday ? 'bg-blue-50/10' : ''
                                }`}
                              >
                                {calendarLoading ? (
                                  /* 💡【新設モーション】フワフワ光るプロ仕様のスケルトン座布団を出現させて待ち時間のストレスを完全破壊 */
                                  <div className="bg-slate-200/70 h-10 rounded animate-pulse w-full border border-slate-300/40"></div>
                                ) : matchedEvents.length > 0 ? (
                                  <div className="space-y-1">
                                    {matchedEvents.map((ev, idx) => (
                                      <div key={idx} className="bg-indigo-50 border-2 border-indigo-200 text-indigo-700 px-1 py-1.5 rounded font-mono font-bold shadow-xs text-[10px] leading-tight">
                                        <span className="text-[8px] font-black text-indigo-400 block mb-0.5 truncate">🟢 RM業務</span>
                                        {ev.time}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 font-sans text-[10px] italic select-none">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>

                </table>
              </div>

              {workers.length === 0 && (
                <div className="p-16 text-center text-slate-400 italic text-xs font-medium bg-slate-50">
                  現在、シフトスケジュールを表示できるワーカーが登録されていません。
                </div>
              )}
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed p-1 font-medium">
              ※この画面は、各ワーカーのGoogleカレンダーに登録されたタイトルに「<span className="text-indigo-600 font-bold">RM業務</span>」を含む予定をシステムが特権ロボット経由で全自動検知し、リアルタイムに24時間同期してプロットしています。
            </p>
          </div>
        )}

      </div>
    </OwnerShell>
  );
}