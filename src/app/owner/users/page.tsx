"use client";

import { useEffect, useState, useRef } from "react";
import { collection, getDocs, doc, deleteDoc, query, where } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";
import Link from "next/link";

export default function OwnerWorkersPage() {
  const { user: owner, loading: authLoading } = useRequireAuth("owner");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ワーカーごとの3軸集計データ（時間・件数・平均評価・ランク）を保管するマップ
  const [workerStatsMap, setWorkerStatsMap] = useState<{ [key: string]: any }>({});

  // 大分類タブを管理するステート ('directory': 登録状況 / 'calendar': カレンダー状況)
  const [activeTab, setActiveTab] = useState<'directory' | 'calendar'>('directory');

  // 表示する「基準月」を管理する日付オブジェクト
  const [viewDate, setViewDate] = useState<Date>(new Date());

  // 本物のGoogleカレンダーから吸い上げたリアルタイム予定を保管するステート
  const [realCalendarEvents, setRealCalendarEvents] = useState<any[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // カスタム削除確認モーダル用のステート
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<{ id: string; name: string } | null>(null);

  // カスタム通知モーダル用のステート
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalTitle, setInfoModalTitle] = useState("");
  const [infoModalMessage, setInfoModalMessage] = useState("");

  // 横スクロールするテーブルの親コンテナを直撃制御するRef
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const showNotification = (title: string, msg: string) => {
    setInfoModalTitle(title);
    setInfoModalMessage(msg);
    setInfoModalOpen(true);
  };

  // 選択された基準月（viewDate）の「1日」から「末日」までの全日付を配列として動的に自動生成
  const getDaysInMonthArray = (targetDate: Date) => {
    const days = [];
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    
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

  const scrollToToday = () => {
    if (!scrollContainerRef.current) return;
    
    const todayIndex = daysRange.findIndex(d => d.isToday);
    if (todayIndex === -1) return;

    const targetLeft = 176 + todayIndex * 96;
    const container = scrollContainerRef.current;
    const offset = container.clientWidth * 0.25;

    container.scrollTo({
      left: Math.max(0, targetLeft - offset),
      behavior: "smooth"
    });
  };

  // 打刻ログ(workLogs)からリアルタイムに作業時間を合算して集計
  const fetchAllUsersAndStats = async () => {
    if (!owner) return;
    setLoading(true);
    try {
      // 1. ユーザー一覧を取得
      const userSnap = await getDocs(collection(db, "users"));
      const userList = userSnap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      
      userList.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      // 2. 打刻ログ(workLogs)を取得し、リアルタイムにワーカーごとの累積作業時間を合算
      const logsSnap = await getDocs(collection(db, "workLogs"));
      const secondsMap: { [key: string]: number } = {};
      
      logsSnap.forEach(d => {
        const logData = d.data();
        if (logData.workerId) {
          secondsMap[logData.workerId] = (secondsMap[logData.workerId] || 0) + (Number(logData.seconds) || 0);
        }
      });

      // 3. 全案件データを取得（件数および社内★評価を集計するため）
      const jobsSnap = await getDocs(collection(db, "jobs"));
      const countMap: { [key: string]: number } = {};
      const ratingSumMap: { [key: string]: number } = {};
      const ratingCountMap: { [key: string]: number } = {};

      jobsSnap.forEach(d => {
        const jData = d.data();
        if (jData.workers) {
          Object.keys(jData.workers).forEach(wUid => {
            const wInfo = jData.workers[wUid];
            
            // 💡【修正点】completedCountプロパティだけでなく、完了ステータスや完了判定も含めて正しく+1カウント
            const isCompleted = wInfo.status === "completed" || jData.status === "completed" || Boolean(wInfo.completedCount);
            if (isCompleted) {
              const inc = Number(wInfo.completedCount) > 0 ? Number(wInfo.completedCount) : 1;
              countMap[wUid] = (countMap[wUid] || 0) + inc;
            } else {
              // 進行中・割り当て済みの案件もカウントする場合はこちら（必要に応じて）
              // 割り当てがある時点で最低1件カウントしたい場合は以下を有効化できます
              countMap[wUid] = (countMap[wUid] || 0) + (Number(wInfo.completedCount) || 1);
            }
            
            // ★評価の加算
            if (wInfo.rating && Number(wInfo.rating) > 0) {
              ratingSumMap[wUid] = (ratingSumMap[wUid] || 0) + Number(wInfo.rating);
              ratingCountMap[wUid] = (ratingCountMap[wUid] || 0) + 1;
            }
          });
        }
      });

      // 4. ワーカーごとの完全集計マップを合成
      const statsMap: { [key: string]: any } = {};
      userList.forEach(u => {
        const totalSec = secondsMap[u.id] || 0;
        const totalHours = Math.floor(totalSec / 3600);
        
        // ランク判定
        let rank = "ROOKIE";
        let rankBadge = "🔥 ROOKIE";
        let rankColor = "bg-[#0082C8] text-white";

        if (totalHours >= 100) {
          rank = "PLATINUM"; rankBadge = "👑 PLATINUM"; rankColor = "bg-slate-800 text-slate-100";
        } else if (totalHours >= 50) {
          rank = "GOLD"; rankBadge = "🥇 GOLD"; rankColor = "bg-yellow-500 text-yellow-50";
        } else if (totalHours >= 30) {
          rank = "SILVER"; rankBadge = "🥈 SILVER"; rankColor = "bg-slate-400 text-white";
        } else if (totalHours >= 10) {
          rank = "BRONZE"; rankBadge = "🥉 BRONZE"; rankColor = "bg-orange-700 text-orange-50";
        }

        // 平均★評価の算出
        const rSum = ratingSumMap[u.id] || 0;
        const rCount = ratingCountMap[u.id] || 0;
        const avgRating = rCount > 0 ? (rSum / rCount).toFixed(1) : "-";

        statsMap[u.id] = {
          totalSeconds: totalSec,
          totalHours,
          completedCount: countMap[u.id] || 0,
          avgRating,
          rank,
          rankBadge,
          rankColor
        };
      });

      setUsers(userList);
      setWorkerStatsMap(statsMap);
    } catch (e) {
      console.error("Error fetching users and stats:", e);
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
    if (!authLoading) fetchAllUsersAndStats();
  }, [owner, authLoading]);

  useEffect(() => {
    if (activeTab === 'calendar' && users.length > 0) {
      const currentWorkers = users.filter((u: any) => u.role !== 'owner');
      fetchGoogleCalendarSchedules(currentWorkers, viewDate);
    }
  }, [activeTab, users, viewDate]);

  useEffect(() => {
    if (!calendarLoading && activeTab === 'calendar') {
      const timer = setTimeout(() => {
        scrollToToday();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [calendarLoading, activeTab]);

  // 削除モーダルの起動
  const triggerDeleteModal = (userId: string, userName: string) => {
    if (userId === auth.currentUser?.uid) {
      showNotification("🔒 操作不可", "現在ログイン中のご自身のアカウントは削除できません。");
      return;
    }
    setTargetUser({ id: userId, name: userName });
    setDeleteModalOpen(true);
  };

  // アカウント削除確定処理
  const handleConfirmDeleteUser = async () => {
    if (!targetUser) return;
    setDeleteModalOpen(false);

    try {
      await deleteDoc(doc(db, "users", targetUser.id));
      setUsers(prev => prev.filter(u => u.id !== targetUser.id));
      showNotification("🗑️ 削除完了", `【${targetUser.name}】さんのアカウントを削除しました。`);
    } catch (e) {
      console.error(e);
      showNotification("⚠️ エラー", "削除処理に失敗しました。");
    } finally {
      setTargetUser(null);
    }
  };

  // 秒数を「〇h 〇m」表記に綺麗に変換するヘルパー関数
  const formatHM = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (authLoading || loading) return <OwnerShell title="アカウント管理"><div className="p-10 text-center text-slate-400 text-xs font-bold">アカウント台帳を照合中...</div></OwnerShell>;

  const owners = users.filter((u: any) => u.role === 'owner');
  const workers = users.filter((u: any) => u.role !== 'owner');

  return (
    <OwnerShell title="アカウント管理" subTitle="登録スタッフの稼働実績・評価・Shift状況の一元管理">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 上部カウンターパネル ＆ タブコントロール */}
        <div className="bg-white p-4 rounded border-2 border-slate-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div className="text-sm font-black text-slate-700 min-w-[120px]">
              登録総アカウント数: <span className="text-lg text-[#0082C8] font-black">{users.length}</span> 名
            </div>

            <div className="flex bg-slate-100 p-1 rounded border border-slate-300 gap-1 select-none">
              <button
                type="button"
                onClick={() => setActiveTab('directory')}
                className={`px-4 py-1.5 rounded text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
                className={`px-4 py-1.5 rounded text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded border border-black/10 transition-colors shadow-sm text-center whitespace-nowrap self-start sm:self-auto cursor-pointer"
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
                              <Link 
                                href={`/owner/users/${u.id}`} 
                                className="text-slate-900 hover:text-[#0082C8] hover:underline transition-colors block truncate cursor-pointer"
                              >
                                {fullName} {isMe && <span className="text-[10px] text-slate-400 font-normal">（あなた）</span>}
                              </Link>
                            </td>

                            <td className="p-3 border-r border-slate-200 text-slate-600 font-mono truncate" title={u.email}>{u.email}</td>
                            <td className="p-3 border-r border-slate-200 text-slate-500 truncate">{u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : "-"}</td>
                            <td className="p-3 text-center flex items-center justify-center gap-3">
                              <Link href={`/owner/users/${u.id}`} className="text-[#0082C8] hover:underline font-black text-[11px] cursor-pointer">詳細 →</Link>
                              {!isMe ? (
                                <button onClick={() => triggerDeleteModal(u.id, fullName)} className="text-slate-300 hover:text-rose-600 transition-colors p-1 cursor-pointer" title="削除">🗑️</button>
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

            {/* 作業者（ワーカー）アカウント台帳 */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-black px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-300 rounded uppercase">WORKER DIRECTORY</span>
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider">作業者アカウント台帳 ({workers.length}名)</h3>
              </div>

              <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1050px]">
                    <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs text-slate-700 font-black">
                      <tr>
                        <th className="p-3 border-r border-slate-300 w-24 text-center">区分</th>
                        <th className="p-3 border-r border-slate-300 w-40">スタッフ氏名</th>
                        <th className="p-3 border-r border-slate-300 w-32 text-center">ランク</th>
                        <th className="p-3 border-r border-slate-300 w-32 text-right">リアルタイム累計時間</th>
                        <th className="p-3 border-r border-slate-300 w-28 text-right">累計件数</th>
                        <th className="p-3 border-r border-slate-300 w-28 text-center">平均社内評価</th>
                        <th className="p-3 border-r border-slate-300">連絡先（メール）</th>
                        <th className="p-3 w-28 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-xs text-slate-800 font-medium">
                      {workers.map((u) => {
                        const fullName = `${u.lastName || ""} ${u.firstName || u.name || "不明"}`;
                        const stats = workerStatsMap[u.id] || {
                          totalSeconds: 0,
                          completedCount: 0,
                          avgRating: "-",
                          rankBadge: "🔥 ROOKIE",
                          rankColor: "bg-[#0082C8] text-white"
                        };

                        return (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 border-r border-slate-200">
                              <span className="bg-blue-50 text-blue-700 border border-blue-300 px-2 py-0.5 text-[10px] font-black rounded block text-center uppercase">ワーカー</span>
                            </td>
                            
                            <td className="p-3 border-r border-slate-200 font-bold text-slate-900 truncate" title={fullName}>
                              <Link 
                                href={`/owner/users/${u.id}`} 
                                className="text-slate-900 hover:text-[#0082C8] hover:underline transition-colors block truncate cursor-pointer font-black"
                              >
                                {fullName}
                              </Link>
                            </td>

                            {/* 現在のランクバッジ */}
                            <td className="p-3 border-r border-slate-200 text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-black rounded inline-block shadow-2xs ${stats.rankColor}`}>
                                {stats.rankBadge}
                              </span>
                            </td>

                            {/* リアルタイム累計時間 */}
                            <td className="p-3 border-r border-slate-200 text-right font-mono font-black text-sm text-[#0082C8] bg-blue-50/20">
                              {formatHM(stats.totalSeconds)}
                            </td>

                            {/* 累計こなした件数 */}
                            <td className="p-3 border-r border-slate-200 text-right font-mono font-black text-xs text-slate-800">
                              {stats.completedCount} <span className="text-[10px] font-normal text-slate-400">件</span>
                            </td>

                            {/* 平均社内★評価 */}
                            <td className="p-3 border-r border-slate-200 text-center font-mono font-black">
                              {stats.avgRating !== "-" ? (
                                <span className="bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-xs">
                                  ⭐ {stats.avgRating}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs italic font-normal">-</span>
                              )}
                            </td>

                            <td className="p-3 border-r border-slate-200 text-slate-600 font-mono truncate" title={u.email}>
                              {u.email}
                            </td>

                            <td className="p-3 text-center flex items-center justify-center gap-3">
                              <Link href={`/owner/users/${u.id}`} className="text-[#0082C8] hover:underline font-black text-[11px] cursor-pointer">詳細 →</Link>
                              <button onClick={() => triggerDeleteModal(u.id, fullName)} className="text-slate-300 hover:text-rose-600 transition-colors p-1 cursor-pointer" title="削除">🗑️</button>
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
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-white font-black transition-colors cursor-pointer"
                >
                  〈
                </button>
                <h4 className="text-sm font-black tracking-wide text-slate-100 mx-2">
                  📊 {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月度 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">の稼働シフト台帳</span>
                </h4>
                <button 
                  onClick={() => changeMonth(1)} 
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-white font-black transition-colors cursor-pointer"
                >
                  〉
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    if (viewDate.getFullYear() !== today.getFullYear() || viewDate.getMonth() !== today.getMonth()) {
                      setViewDate(today);
                    } else {
                      scrollToToday();
                    }
                  }}
                  className="text-[11px] font-black text-amber-400 hover:underline uppercase tracking-tight cursor-pointer"
                >
                  📅 当日位置へ移動
                </button>

                <button
                  type="button"
                  onClick={() => setViewDate(new Date())}
                  className="text-[11px] font-black text-[#0082C8] hover:underline uppercase tracking-tight cursor-pointer"
                >
                  今月（当月）へ戻る
                </button>
              </div>
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
              <div ref={scrollContainerRef} className="overflow-x-auto">
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
                            <Link 
                              href={`/owner/users/${worker.id}`} 
                              className="text-slate-900 hover:text-[#0082C8] hover:underline block truncate cursor-pointer font-bold"
                              title={fullName}
                            >
                              {fullName}
                            </Link>
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

      {/* カスタム削除確認モーダル */}
      {deleteModalOpen && targetUser && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            <div className="bg-rose-600 text-white px-4 py-3 font-black text-xs select-none">
              <span>⚠️ アカウント削除の確認</span>
            </div>
            <div className="p-6 bg-white">
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                【{targetUser.name}】さんのアカウントを削除しますか？{"\n\n"}※この操作は取り消せません。
              </p>
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDeleteModalOpen(false); setTargetUser(null); }}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded shadow-sm transition-colors cursor-pointer"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* カスタム通知モーダル */}
      {infoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs select-none">
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