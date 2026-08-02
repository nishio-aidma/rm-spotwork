"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, getDocs, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import WorkerShell from "@/components/WorkerShell";

export default function WorkerProfilePage() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // プロフィール編集モード用のステート
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ selfIntroduction: "", availableHours: "" });

  // カスタムポップアップ（通知用）
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoModalMessage, setInfoModalMessage] = useState("");

  const showInfoModal = (msg: string) => {
    setInfoModalMessage(msg);
    setInfoModalOpen(true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. ユーザー基本情報の取得
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);
          const userData = userSnap.exists() ? userSnap.data() : {};

          // 2. 作業件数の自動集計（各案件で入力したcompletedCountを合算）
          const jobsSnap = await getDocs(collection(db, "jobs"));
          let completedCount = 0;
          jobsSnap.forEach(d => {
            const jobData = d.data();
            if (jobData.workers && jobData.workers[user.uid]) {
              const wInfo = jobData.workers[user.uid];
              if (wInfo.completedCount) {
                completedCount += Number(wInfo.completedCount || 0);
              } else if (wInfo.status === "completed" || jobData.status === "completed") {
                completedCount += 1;
              }
            }
          });

          // 3. 確定済みの累計稼働時間 ＆ 月別履歴の取得
          const monthlyQ = query(collection(db, "workerMonthlyStatus"), where("workerId", "==", user.uid));
          const monthlySnap = await getDocs(monthlyQ);
          let totalSec = 0;
          const monthlyHistory: any[] = [];
          
          monthlySnap.forEach(d => {
            const mData = d.data();
            if (mData.status === "confirmed") {
              totalSec += (mData.totalSeconds || 0);
              monthlyHistory.push(mData);
            }
          });
          // 月の降順（新しい順）に並び替え
          monthlyHistory.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

          // システム登録日の取得
          const registeredDate = user.metadata.creationTime 
            ? new Date(user.metadata.creationTime).toLocaleDateString('ja-JP') 
            : "不明";

          // ランク定義と目標時間の計算
          const totalHours = Math.floor(totalSec / 3600);
          let calculatedRank = "ROOKIE";
          let nextTargetHours = 10;
          
          if (totalHours >= 100) { calculatedRank = "PLATINUM"; nextTargetHours = 100; }
          else if (totalHours >= 50) { calculatedRank = "GOLD"; nextTargetHours = 100; }
          else if (totalHours >= 30) { calculatedRank = "SILVER"; nextTargetHours = 50; }
          else if (totalHours >= 10) { calculatedRank = "BRONZE"; nextTargetHours = 30; }

          // 全データを統合してセット
          setUserProfile({
            uid: user.uid,
            displayName: user.displayName || userData.displayName || "ワーカー",
            email: user.email || userData.email || "",
            selfIntroduction: userData.selfIntroduction || "",
            availableHours: userData.availableHours || "",
            rank: calculatedRank,
            nextTargetHours,
            totalAccumulatedSeconds: totalSec,
            completedJobsCount: completedCount,
            registeredDate,
            monthlyHistory
          });

          // 編集用データにも初期値をセット
          setEditData({
            selfIntroduction: userData.selfIntroduction || "",
            availableHours: userData.availableHours || ""
          });

        } catch (e) {
          console.error("プロファイル情報の取得に失敗しました:", e);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // プロフィール保存処理
  const handleSaveProfile = async () => {
    if (!userProfile) return;
    setSubmitting(true);
    try {
      const userDocRef = doc(db, "users", userProfile.uid);
      await setDoc(userDocRef, {
        selfIntroduction: editData.selfIntroduction,
        availableHours: editData.availableHours
      }, { merge: true });

      setUserProfile((prev: any) => ({
        ...prev,
        selfIntroduction: editData.selfIntroduction,
        availableHours: editData.availableHours
      }));
      setIsEditing(false);
      showInfoModal("✅ プロフィール情報を保存しました！");
    } catch (e) {
      console.error(e);
      showInfoModal("⚠️ 保存に失敗しました。ネットワーク状況をご確認ください。");
    } finally {
      setSubmitting(false);
    }
  };

  // 秒数を「〇h 〇m」の形に綺麗に整える変換マシン
  const formatHoursMinutes = (totalSeconds: number) => {
    const s = totalSeconds || 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}`;
  };

  if (loading) return <WorkerShell title="マイプロファイル"><div className="p-10 text-center text-slate-400 text-xs font-bold">個人実績データを照合中...</div></WorkerShell>;
  if (!userProfile) return <WorkerShell title="マイプロファイル"><div className="p-10 text-center text-rose-600 font-bold text-xs">ログインセッションの確認に失敗しました。</div></WorkerShell>;

  // ランク計算用の定数
  const currentRank = userProfile.rank || "ROOKIE";
  const currentSeconds = userProfile.totalAccumulatedSeconds || 0;
  const currentHours = Math.floor(currentSeconds / 3600);
  const targetHours = userProfile.nextTargetHours || 10;
  
  // PLATINUM（最高ランク）の場合は100%にする
  const progressPercent = currentHours >= 100 ? 100 : Math.min(100, Math.floor((currentHours / targetHours) * 100));

  // ランク全体マップの定義（カラーをセージグリーンに変更）
  const rankMap = [
    { name: "PLATINUM", hours: 100, color: "bg-slate-800 text-slate-100", icon: "👑" },
    { name: "GOLD", hours: 50, color: "bg-yellow-500 text-yellow-50", icon: "🥇" },
    { name: "SILVER", hours: 30, color: "bg-slate-400 text-white", icon: "🥈" },
    { name: "BRONZE", hours: 10, color: "bg-orange-700 text-orange-50", icon: "🥉" },
    { name: "ROOKIE", hours: 0, color: "bg-[#5CA685] text-white", icon: "🔥" },
  ];

  return (
    <WorkerShell title="マイプロファイル" subTitle="個人実績および所属ランク確認">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-full mx-auto pb-20 text-slate-900 font-sans antialiased">
        
        {/* 【左側メインエリア：8カラム分】 */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* ユーザー基本情報 ＆ プロフィール編集エリア */}
          <div className="bg-white border-2 border-slate-300 rounded p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-black tracking-tight text-slate-950">{userProfile.displayName}</h1>
                  <span className={`font-black text-xs md:text-sm px-3 py-1 rounded shadow-sm inline-flex items-center gap-1 uppercase tracking-wider select-none ${
                    rankMap.find(r => r.name === currentRank)?.color || "bg-[#5CA685] text-white"
                  }`}>
                    {rankMap.find(r => r.name === currentRank)?.icon} {currentRank}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium tracking-wide">{userProfile.email}</p>
              </div>
              
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-black px-4 py-2 rounded transition-colors shadow-sm active:scale-95 cursor-pointer"
                >
                  ✏️ プロフ編集
                </button>
              )}
            </div>

            {/* 自己紹介・稼働時間の表示/編集エリア */}
            {isEditing ? (
              <div className="space-y-3 bg-slate-50 p-4 rounded border border-slate-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">自己紹介 / 得意な業務</label>
                  <textarea
                    value={editData.selfIntroduction}
                    onChange={(e) => setEditData({...editData, selfIntroduction: e.target.value})}
                    placeholder="例：データ入力やリサーチ作業が得意です。平日の日中メインで活動しています。"
                    className="w-full border border-slate-300 rounded p-2 text-xs font-medium text-slate-800 outline-none focus:border-[#5CA685] h-20 resize-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">1週間の稼働可能時間（目安）</label>
                  <input
                    type="text"
                    value={editData.availableHours}
                    onChange={(e) => setEditData({...editData, availableHours: e.target.value})}
                    placeholder="例：週10〜15時間程度"
                    className="w-full border border-slate-300 rounded p-2 text-xs font-medium text-slate-800 outline-none focus:border-[#5CA685]"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditData({ selfIntroduction: userProfile.selfIntroduction, availableHours: userProfile.availableHours });
                      setIsEditing(false);
                    }}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-600 font-black text-xs rounded hover:bg-slate-100 cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={submitting}
                    className="px-5 py-2 bg-[#5CA685] hover:bg-[#4A9272] text-white font-black text-xs rounded shadow-sm transition-colors cursor-pointer"
                  >
                    保存する
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase block">自己紹介 / 得意な業務</span>
                  <p className="text-xs text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">
                    {userProfile.selfIntroduction || <span className="text-slate-300 italic">未登録</span>}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase block">1週間の稼働可能時間（目安）</span>
                  <p className="text-xs text-slate-800 font-bold">
                    {userProfile.availableHours || <span className="text-slate-300 italic font-normal">未登録</span>}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 累計実績データ内訳（集計値） */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700">累計実績データ内訳</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">TOTALS</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-300 text-center">
              <div className="p-5 space-y-1 bg-emerald-50/30">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">確定済みの累計作業時間</span>
                <p className="text-3xl font-black text-[#5CA685] tracking-tight font-mono tabular-nums pt-1">
                  {formatHoursMinutes(userProfile.totalAccumulatedSeconds)}
                </p>
              </div>

              <div className="p-5 space-y-1 flex flex-col justify-center">
                {/* 💡 表記の修正: 完了案件数 → 累計作業件数 */}
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">累計作業件数</span>
                <p className="text-2xl font-black text-slate-900 font-mono pt-1">
                  {userProfile.completedJobsCount} <span className="text-xs font-bold text-slate-500">件</span>
                </p>
              </div>

              <div className="p-5 space-y-1 flex flex-col justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">システム登録日</span>
                <p className="text-sm font-mono font-bold text-slate-600 pt-2">
                  {userProfile.registeredDate}
                </p>
              </div>
            </div>
          </div>

          {/* 過去の月別稼働履歴リスト */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700">月別の稼働履歴（提出・確定済み）</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">HISTORY</span>
            </div>
            
            <div className="divide-y divide-slate-200">
              {userProfile.monthlyHistory && userProfile.monthlyHistory.length > 0 ? (
                userProfile.monthlyHistory.map((m: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black font-mono text-slate-800">{m.yearMonth.replace('-', '年 ')}月</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-2 py-0.5 rounded border border-emerald-200">確定済</span>
                    </div>
                    <span className="text-lg font-black font-mono text-[#5CA685]">
                      {formatHoursMinutes(m.totalSeconds)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs font-medium italic">
                  まだ確定・提出済みの月次履歴はありません。
                </div>
              )}
            </div>
          </div>

        </div>

        {/* 【右側サブエリア：4カラム分】 */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* ランク進捗ゲージ */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700">NEXT RANK PROGRESS</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">RANK UP</span>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-end text-xs">
                <span className="font-bold text-slate-500">
                  {currentRank === "PLATINUM" ? "最高ランク到達✨" : "次ランクへの足跡"}
                </span>
                <span className="font-mono font-bold text-slate-700">
                  <span className="text-sm text-slate-950 font-black">{currentHours}.0h</span>
                  {currentRank !== "PLATINUM" && ` / ${targetHours}h`}
                </span>
              </div>

              <div className="w-full bg-slate-100 border-2 border-slate-300 h-6 rounded overflow-hidden relative shadow-inner">
                <div 
                  className="bg-[#5CA685] h-full border-r-2 border-slate-950 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-black text-slate-800 drop-shadow-sm pointer-events-none uppercase">
                  {progressPercent}% completed
                </div>
              </div>
            </div>
          </div>

          {/* ランクの全体マップ */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300">
              <span className="text-xs font-black text-slate-700">ランクアップ条件マップ</span>
            </div>
            
            <div className="p-4 space-y-2">
              {rankMap.map((rank) => {
                const isCurrent = rank.name === currentRank;
                return (
                  <div key={rank.name} className={`flex items-center justify-between p-2.5 rounded border-2 transition-all ${
                    isCurrent ? 'bg-emerald-50 border-[#5CA685] shadow-sm' : 'bg-white border-slate-100 opacity-60'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{rank.icon}</span>
                      <span className={`text-xs font-black tracking-wide ${isCurrent ? 'text-[#5CA685]' : 'text-slate-600'}`}>
                        {rank.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-black text-slate-500">
                      {rank.hours}h 〜
                    </span>
                  </div>
                );
              })}
              <p className="text-[9px] text-slate-400 font-medium pt-2 text-center">
                ※累計稼働時間が規定に達すると自動でランクアップします。
              </p>
            </div>
          </div>

        </div>

      </div>

      {/* カスタム完了通知ポップアップ */}
      {infoModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            <div className="bg-[#5CA685] text-white px-4 py-3 font-black text-xs select-none">
              <span>🔔 お知らせ</span>
            </div>
            <div className="p-6 bg-white text-center">
              <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                {infoModalMessage}
              </p>
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-center">
              <button
                type="button"
                onClick={() => setInfoModalOpen(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded shadow-sm cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

    </WorkerShell>
  );
}