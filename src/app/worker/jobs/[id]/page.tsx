"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import WorkerShell from "@/components/WorkerShell";
import Link from "next/link";
import Image from "next/image";

interface WorkerJobDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function WorkerJobDetailPage({ params }: WorkerJobDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [isWished, setIsWished] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // 💡 secondsには「これまでの過去の確定した合計秒数」＋「現在進行中の差分秒数」がリアルタイムに入ります
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // カスタムポップアップ（モーダル）用の管理ステート
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalActionType, setModalActionType] = useState<"accept" | "start" | "pause" | "complete" | null>(null);

  // 初期データの取得
  useEffect(() => {
    async function fetchData() {
      const user = auth.currentUser;
      if (!id || !user) return;
      try {
        const docRef = doc(db, "jobs", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setJob({ id: snap.id, ...data });
          
          // 💡初期化ロジック：基本は過去の累計秒数をセット
          const baseSec = data.totalAccumulatedSeconds || 0;
          setSeconds(baseSec);
        }

        const wishSnap = await getDoc(doc(db, "wishlists", `${user.uid}_${id}`));
        setIsWished(wishSnap.exists());

      } catch (error) { 
        console.error(error); 
      } finally { 
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  // 💡最強の打刻タイマー監視ロジック：1秒ごとに「現在時刻 - 開始時刻」を引き算して反映
  useEffect(() => {
    if (job?.status === "working") {
      const updateTimer = () => {
        const baseSeconds = job.totalAccumulatedSeconds || 0;
        
        // データベースに刻印された開始時間をJavaScriptの日付オブジェクトに変換
        if (job.lastStartedAt) {
          const startedTime = job.lastStartedAt.toDate 
            ? job.lastStartedAt.toDate().getTime() 
            : new Date(job.lastStartedAt).getTime();
          
          const nowTime = new Date().getTime();
          
          // 通算ミリ秒の差分を引き算し、秒に変換
          const elapsedSinceStart = Math.floor((nowTime - startedTime) / 1000);
          
          // 過去の合計 ＋ 今回のリアルタイム経過分
          // もしもフリーズ後に時間がマイナスに計算されるのを防ぐため、最低でもbaseSecondsをキープする安全弁付き
          setSeconds(Math.max(baseSeconds, baseSeconds + elapsedSinceStart));
        } else {
          setSeconds(baseSeconds);
        }
      };

      // 画面を開いた瞬間にも一度同期を実行
      updateTimer();

      // 1秒に1回の高頻度で引き算結果をリフレッシュ
      timerRef.current = setInterval(updateTimer, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setSeconds(job?.totalAccumulatedSeconds || 0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [job?.status, job?.lastStartedAt, job?.totalAccumulatedSeconds]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const handleToggleWish = async () => {
    const user = auth.currentUser;
    if (!user || !job) return;
    
    const wishRef = doc(db, "wishlists", `${user.uid}_${job.id}`);
    try {
      if (isWished) {
        await deleteDoc(wishRef);
        setIsWished(false);
      } else {
        await setDoc(wishRef, {
          workerId: user.uid,
          jobId: job.id,
          createdAt: new Date()
        });
        setIsWished(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ポップアップを起動する窓口
  const triggerModal = (type: "accept" | "start" | "pause" | "complete") => {
    setModalActionType(type);
    if (type === "accept") {
      setModalTitle("⚠️ 案件受諾の確認");
      setModalMessage("この案件を引き受けますか？\n引き受けると、あなたの「進行中のタスク」リストに格納され、いつでも作業可能になります。");
    } else if (type === "start") {
      setModalTitle("⏱️ 作業開始（打刻スタート）");
      setModalMessage("これより実稼働の計測を開始します。\n開始日時が金庫に記録されるため、万が一PCがフリーズしても作業時間は守られます。");
    } else if (type === "pause") {
      setModalTitle("⏸️ 一時停止（打刻ホールド）");
      setModalMessage("現在のタイマーをホールドし、一時停止状態へ移行します。\n開始した日時との差分が自動計算され、累計時間に蓄積されます。");
    } else if (type === "complete") {
      setModalTitle("🏁 完了報告（最終打刻と検収依頼）");
      setModalMessage("作業を完全に終了し、オーナーへ検収を依頼します。\n最終作業時間が自動計算されてロックされ、この操作は取り消せなくなりますがよろしいですか？");
    }
    setModalOpen(true);
  };

  // ポップアップ内で「はい、実行する」を押したときの確定処理
  const handleModalConfirm = async () => {
    setModalOpen(false);
    if (!modalActionType || !job) return;

    setSubmitting(true);
    try {
      const jobRef = doc(db, "jobs", job.id);
      const now = new Date();

      if (modalActionType === "accept") {
        await updateDoc(jobRef, {
          workerId: auth.currentUser?.uid,
          status: "assigned",
          updatedAt: serverTimestamp()
        });
        const snap = await getDoc(jobRef);
        setJob({ id: snap.id, ...snap.data() });
      } 
      
      // 💡【開始】始まった瞬間をサーバー時間（serverTimestamp）でガチッと固定
      else if (modalActionType === "start") {
        await updateDoc(jobRef, {
          status: "working",
          lastStartedAt: serverTimestamp(), // ← いつ始まったかを記録
          updatedAt: serverTimestamp()
        });
        const snap = await getDoc(jobRef);
        setJob({ id: snap.id, ...snap.data() });
      } 
      
      // 💡【一時停止】停止ボタンを押した瞬間と、過去の開始時間をミリ秒で正確に引き算
      else if (modalActionType === "pause") {
        const baseSeconds = job.totalAccumulatedSeconds || 0;
        let finalSeconds = baseSeconds;

        if (job.lastStartedAt) {
          const startedTime = job.lastStartedAt.toDate 
            ? job.lastStartedAt.toDate().getTime() 
            : new Date(job.lastStartedAt).getTime();
          
          const elapsed = Math.floor((now.getTime() - startedTime) / 1000);
          finalSeconds = Math.max(baseSeconds, baseSeconds + elapsed);
        }

        await updateDoc(jobRef, {
          status: "paused",
          totalAccumulatedSeconds: finalSeconds, // 引き算した確定秒数を金庫へ上書き
          updatedAt: serverTimestamp()
        });
        const snap = await getDoc(jobRef);
        setJob({ id: snap.id, ...snap.data() });
      } 
      
      // 💡【作業完了】一時停止の時と同じ計算を行い、最終秒数を確定させて検収へ
      else if (modalActionType === "complete") {
        const baseSeconds = job.totalAccumulatedSeconds || 0;
        let finalSeconds = baseSeconds;

        if (job.lastStartedAt) {
          const startedTime = job.lastStartedAt.toDate 
            ? job.lastStartedAt.toDate().getTime() 
            : new Date(job.lastStartedAt).getTime();
          
          const elapsed = Math.floor((now.getTime() - startedTime) / 1000);
          finalSeconds = Math.max(baseSeconds, baseSeconds + elapsed);
        }

        await updateDoc(jobRef, {
          status: "review",
          totalAccumulatedSeconds: finalSeconds,
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        router.push("/worker/my-jobs");
      }
    } catch (e) {
      console.error(e);
      alert("処理に失敗しました。");
    } finally {
      setSubmitting(false);
      setModalActionType(null);
    }
  };

  if (loading) return <WorkerShell title="読み込み中"><div className="p-10 text-center text-slate-400 text-xs font-bold">データを取得中...</div></WorkerShell>;
  if (!job) return <WorkerShell title="エラー"><div className="p-10 text-center text-rose-600 font-bold text-xs">案件が見つかりませんでした。</div></WorkerShell>;

  const isMyJob = job.workerId === auth.currentUser?.uid;

  return (
    <WorkerShell title="案件詳細" subTitle="業務内容の確認と計測">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-full mx-auto pb-32 text-slate-900 font-sans antialiased">
        
        {/* 左側メイン情報 */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* 戻るコントロールバー */}
          <div className="flex justify-between items-center bg-white border-2 border-slate-300 p-3 rounded shadow-sm">
            <button 
              type="button"
              onClick={() => router.push("/worker/jobs")} 
              className="bg-slate-100 border-2 border-slate-400 hover:bg-slate-200 text-slate-800 text-[11px] font-black px-4 py-1.5 rounded transition-all active:scale-95 shadow-sm"
            >
              🔙 案件を探す（一覧）に戻る
            </button>
            <div className="flex gap-2">
              <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded font-bold text-[10px]">
                {job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}
              </span>
              {job.urgency === "3" && (
                <span className="text-[10px] font-black px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-300">至急</span>
              )}
            </div>
          </div>

          {/* 案件タイトル */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 shadow-sm">
            <h1 className="text-base font-black tracking-tight text-slate-950 leading-snug">{job.title}</h1>
          </div>

          {/* 4連スペック台帳グリッド */}
          <div className="grid grid-cols-1 sm:grid-cols-4 bg-white border-2 border-slate-300 rounded overflow-hidden divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-300 shadow-sm">
            <div className="p-3 bg-slate-50/60 flex flex-col justify-between min-h-[72px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">架電システム</span>
              <div className="flex items-center justify-between gap-1 mt-auto">
                <div className="bg-white px-1.5 py-0.5 rounded border border-slate-200 flex items-center justify-center w-[64px] h-[22px] relative overflow-hidden select-none">
                  <Image src="/salescrowd-logo.png" alt="SC" fill className="object-contain" priority />
                </div>
                <a href="https://sales-crowd.jp/" target="_blank" rel="noopener noreferrer" className="bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black px-2 py-1 rounded transition-colors shadow-sm whitespace-nowrap">開く ↗</a>
              </div>
            </div>
            <div className="p-3 flex flex-col justify-between min-h-[72px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">SCクライアント</span>
              <p className="text-xs font-black text-slate-900 truncate mt-auto">{job.scClient || "-"}</p>
            </div>
            <div className="p-3 flex flex-col justify-between min-h-[72px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                {job.jobType === 'form_posting' ? '入力情報' : '入力項目'}
              </span>
              <div className="mt-auto flex justify-between items-center">
                <span className="text-[11px] font-bold text-slate-600">指示書等</span>
                {job.jobType === 'form_posting' ? (
                  job.inputInfo ? (
                    <a href={job.inputInfo} target="_blank" rel="noopener noreferrer" className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-[10px] font-black px-2 py-1 rounded transition-colors shadow-sm whitespace-nowrap">開く ↗</a>
                  ) : <span className="text-[10px] text-slate-300">-</span>
                ) : (
                  job.targetItems ? (
                    <a href={job.targetItems} target="_blank" rel="noopener noreferrer" className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-[10px] font-black px-2 py-1 rounded transition-colors shadow-sm whitespace-nowrap">開く ↗</a>
                  ) : <span className="text-[10px] text-slate-300">-</span>
                )}
              </div>
            </div>
            <div className="p-3 flex flex-col justify-between min-h-[72px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">予定作業件数</span>
              <p className="text-xs font-black text-slate-900 font-mono text-right mt-auto">{job.count || 0} 件</p>
            </div>
          </div>

          {/* メイン共有URL */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
            <div className="flex justify-between items-center">
              <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#0082C8] pl-2">
                {job.jobType === "form_posting" ? "送信文面内容データ" : "抽出サイトURLターゲット"}
              </h2>
              {job.jobType === "form_posting" ? (
                job.formContent && <a href={job.formContent} target="_blank" rel="noopener noreferrer" className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">📄 本文を開く ↗</a>
              ) : (
                job.siteUrl && <a href={job.siteUrl} target="_blank" rel="noopener noreferrer" className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">🌐 サイトを開く ↗</a>
              )}
            </div>
            {!job.formContent && !job.siteUrl && <div className="text-xs text-slate-400 italic p-1">URLは指定されていません。</div>}
          </div>

          {/* 作業手順明細 */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-emerald-600 pl-2">作業手順明細</h2>
            <div className="divide-y-2 divide-slate-200 border-2 border-slate-200 rounded overflow-hidden bg-slate-50">
              {Array.isArray(job.procedures) && job.procedures.length > 0 ? (
                job.procedures.map((step: string, i: number) => (
                  <div key={i} className="flex gap-3 items-center p-2.5 bg-white text-xs">
                    <span className="text-[11px] bg-slate-100 border border-slate-300 text-slate-500 px-1.5 py-0.5 font-mono font-bold rounded">{String(i + 1).padStart(2, '0')}</span>
                    <p className="text-xs font-bold text-slate-800 flex-1">{step || "未設定"}</p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-[10px] text-slate-400 italic">手順の指定はありません。</div>
              )}
            </div>
          </div>

          {job.memo && (
            <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
              <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-amber-500 pl-2">特記事項 / メモ欄</h2>
              <div className="bg-amber-50/30 border border-amber-200 rounded p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">{job.memo}</div>
            </div>
          )}
        </div>

        {/* 右側：コントロールパネル */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 h-fit space-y-3">
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700">現在のステータス</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">CONTROL</span>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-slate-50 border-2 border-slate-200 p-3 rounded text-center">
                <div className={`text-sm font-black ${job.status === 'working' ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
                  {job.status === 'open' ? '🔓 未受諾（募集中）' : 
                   job.status === 'assigned' ? '📥 受諾済み（準備中）' : 
                   job.status === 'working' ? '🔴 作業中' : 
                   job.status === 'paused' ? '⏸️ 一時停止中' : 
                   job.status === 'review' ? '⌛ オーナー検収待ち' : job.status}
                </div>
              </div>

              {(job.status === "working" || job.status === "paused") && (
                <div className="p-4 bg-slate-950 text-white rounded text-center font-mono shadow-inner">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">ELAPSED TIME / 計測時間</span>
                  <p className="text-2xl font-black text-emerald-400 tracking-tight tabular-nums">{formatTime(seconds)}</p>
                </div>
              )}

              <div className="space-y-2">
                {job.status === 'open' && (
                  <button 
                    type="button"
                    onClick={handleToggleWish}
                    className={`w-full py-2.5 text-xs font-black rounded border-2 transition-colors ${
                      isWished ? 'bg-amber-400 text-slate-900 border-transparent' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {isWished ? "★ ウィッシュリストから外す" : "☆ ウィッシュリストに保存"}
                  </button>
                )}

                {!isMyJob ? (
                  <button 
                    type="button"
                    onClick={() => triggerModal("accept")}
                    disabled={submitting}
                    className="w-full py-3 bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black rounded border border-black/10 transition-colors shadow-sm disabled:opacity-50"
                  >
                    この案件を引き受ける
                  </button>
                ) : (
                  <>
                    {job.status === "assigned" && (
                      <button 
                        type="button"
                        onClick={() => triggerModal("start")}
                        disabled={submitting}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded border border-black/10 transition-colors shadow-sm"
                      >
                        ⏱️ 作業を開始する
                      </button>
                    )}

                    {job.status === "paused" && (
                      <button 
                        type="button"
                        onClick={() => triggerModal("start")}
                        disabled={submitting}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded border border-black/10 transition-colors shadow-sm"
                      >
                        ▶️ 作業を再開する
                      </button>
                    )}

                    {job.status === "working" && (
                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          type="button"
                          onClick={() => triggerModal("pause")}
                          disabled={submitting}
                          className="w-full py-3 bg-slate-200 hover:bg-slate-300 border-2 border-slate-400 text-slate-700 text-xs font-black rounded transition-colors"
                        >
                          ⏸️ 一時停止する
                        </button>
                        <button 
                          type="button"
                          onClick={() => triggerModal("complete")}
                          disabled={submitting}
                          className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded border border-black/10 transition-colors shadow-md"
                        >
                          🏁 作業を完了する
                        </button>
                      </div>
                    )}

                    {job.status === "review" && (
                      <div className="p-3 bg-amber-50 border-2 border-amber-300 text-amber-800 text-center rounded text-xs font-bold">
                        ただいまオーナーの検収を待っています。
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed p-2 font-medium">※作業完了を報告するとオーナーに通知され、タイマーがロックされます。オーナーの承認（検収）をもって報酬確定となります。</p>
        </div>

      </div>

      {/* POSレジ風ソリッドデザイン・カスタム確認ポップアップ（モーダル） */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans antialiased">
          <div className="bg-white border-4 border-slate-950 w-full max-w-sm rounded shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden text-slate-900">
            
            <div className="bg-slate-950 text-white p-3 font-black text-xs flex justify-between items-center tracking-wider select-none">
              <span>{modalTitle}</span>
              <span className="text-[9px] font-mono font-bold text-slate-400">ALERT INTERFACE</span>
            </div>

            <div className="p-5 border-b-2 border-slate-200 bg-slate-50">
              <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                {modalMessage}
              </p>
            </div>

            <div className="grid grid-cols-2 divide-x-4 divide-slate-950 border-t-2 border-slate-950 bg-white">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="py-3.5 bg-white text-slate-600 hover:bg-slate-100 font-black text-xs text-center transition-colors outline-none tracking-wide"
              >
                ❌ いいえ
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                className="py-3.5 bg-slate-900 text-white hover:bg-slate-800 font-black text-xs text-center transition-colors outline-none tracking-wide"
              >
                ⭕ はい、実行する
              </button>
            </div>

          </div>
        </div>
      )}

    </WorkerShell>
  );
}