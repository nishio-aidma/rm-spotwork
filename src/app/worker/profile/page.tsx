"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import WorkerShell from "@/components/WorkerShell";

export default function WorkerProfilePage() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 今後の拡張性を見据え、usersコレクションから個人の累計実績を引く構造を担保
          const docRef = doc(db, "users", user.uid);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setUserProfile(snap.data());
          } else {
            // データベース側にまだマイページ書類がない場合の安全な初期仮データ
            setUserProfile({
              displayName: user.displayName || "worker テスト",
              email: user.email || "smb.concierge@aidma-hd.jp",
              rank: "ROOKIE",
              totalAccumulatedSeconds: 0, // 累計作業秒数（初期値）
              completedJobsCount: 0,      // 完了案件数（初期値）
              registeredDate: "2026/5/25" // システム登録日
            });
          }
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

  // 秒数を「〇h 〇m」の形に綺麗に整える変換マシン
  const formatHoursMinutes = (totalSeconds: number) => {
    const s = totalSeconds || 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  if (loading) return <WorkerShell title="マイプロファイル"><div className="p-10 text-center text-slate-400 text-xs font-bold">個人実績データを照合中...</div></WorkerShell>;
  if (!userProfile) return <WorkerShell title="マイプロファイル"><div className="p-10 text-center text-rose-600 font-bold text-xs">ログインセッションの確認に失敗しました。</div></WorkerShell>;

  // 次のランク（100時間目標）への進捗計算
  const currentSeconds = userProfile.totalAccumulatedSeconds || 0;
  const currentHours = Math.floor(currentSeconds / 3600);
  const targetHours = 100;
  const progressPercent = Math.min(100, Math.floor((currentHours / targetHours) * 100));

  return (
    <WorkerShell title="マイプロファイル" subTitle="個人実績および所属ランク確認">
      {/* 画面全体を「左：メイン実績（8カラム）」「右：ランク進捗（4カラム）」の黄金比2分割へ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-full mx-auto pb-20 text-slate-900 font-sans antialiased">
        
        {/* 【左側メインエリア：8カラム分】 */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* ユーザー基本情報：Wアイコンを廃止し、名前と拡大ランクバッジをスマートに並列 */}
          <div className="bg-white border-2 border-slate-300 rounded p-5 shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-black tracking-tight text-slate-950">{userProfile.displayName}</h1>
                
                {/* 💡変更点："ROOKIE" ランクバッジをパッと目を引く大きめサイズ（text-sm py-1）にパワーアップ！ */}
                <span className="bg-[#0082C8] text-white font-black text-xs md:text-sm px-3 py-1 rounded shadow-sm inline-flex items-center gap-1 uppercase tracking-wider select-none animate-pulse">
                  🔥 {userProfile.rank || "ROOKIE"}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">{userProfile.email}</p>
            </div>
          </div>

          {/* 💡場所交換＆デザイン最適化：「累計実績データ内訳」を左側の特等席へ！ */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700">累計実績データ内訳</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">TOTALS</span>
            </div>
            
            {/* メインである「稼働実績」が横広に美しく並ぶ、3格子ブロック型のワイド台帳デザイン */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-300 text-center">
              
              {/* 最重要項目：累計作業時間 */}
              <div className="p-5 space-y-1 bg-slate-50/50">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">累計作業時間（メイン稼働）</span>
                <p className="text-3xl font-black text-[#0082C8] tracking-tight font-mono tabular-nums pt-1">
                  {formatHoursMinutes(userProfile.totalAccumulatedSeconds)}
                </p>
              </div>

              {/* 完了案件数 */}
              <div className="p-5 space-y-1 flex flex-col justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">完了案件数</span>
                <p className="text-2xl font-black text-slate-900 font-mono pt-1">
                  {userProfile.completedJobsCount || 0} <span className="text-xs font-bold text-slate-500">件</span>
                </p>
              </div>

              {/* システム登録日 */}
              <div className="p-5 space-y-1 flex flex-col justify-center">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">システム登録日</span>
                <p className="text-sm font-mono font-bold text-slate-600 pt-2">
                  {userProfile.registeredDate || "-"}
                </p>
              </div>

            </div>
          </div>

        </div>

        {/* 【右側サブエリア：4カラム分】 */}
        <div className="lg:col-span-4 h-fit">
          
          {/* 💡場所交換＆デザイン最適化：「NEXT RANK PROGRESS」を右側に縦型コンパクトカードとして格納 */}
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700">NEXT RANK PROGRESS</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">RANK UP</span>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex justify-between items-end text-xs">
                <span className="font-bold text-slate-500">次ランクへの足跡</span>
                <span className="font-mono font-bold text-slate-700">
                  <span className="text-sm text-slate-950 font-black">{currentHours}.0h</span> / {targetHours}h
                </span>
              </div>

              {/* 横幅が狭い右側カラムにぴったり馴染む、引き締まったプログレスゲージ */}
              <div className="w-full bg-slate-100 border-2 border-slate-300 h-6 rounded overflow-hidden relative shadow-inner">
                <div 
                  className="bg-emerald-500 h-full border-r-2 border-slate-950 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-black text-slate-800 drop-shadow-sm pointer-events-none uppercase">
                  {progressPercent}% completed
                </div>
              </div>
              
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-50 border border-slate-200 rounded p-2 text-center">
                ※累計作業時間が100時間に到達すると、自動的に次の所属ランク章が授与されます。
              </p>
            </div>
          </div>

        </div>

      </div>
    </WorkerShell>
  );
}