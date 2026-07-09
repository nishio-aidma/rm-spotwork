"use client";

import { useEffect, useState, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, deleteDoc, collection, addDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
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
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // ワーカーのコメント・作業メモ入力を管理するステート
  const [workerComment, setWorkerComment] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);

  // カスタムポップアップ（モーダル）用の管理ステート
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalActionType, setModalActionType] = useState<"accept" | "start" | "pause" | "complete" | "save_success" | null>(null);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 初期データの取得
  useEffect(() => {
    if (!id) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const docRef = doc(db, "jobs", id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data() as any;
            
            // 💡【過去データの救済処置】もし過去に作られた「古い1人専用の案件」だった場合、
            // 画面のメモリ上で自動的に複数人用のデータ構造に形を変換して、システムが壊れるのを防ぎます。
            let processedJob = { id: snap.id, ...data };
            if (data.workerId && !data.workers) {
              processedJob.workers = {
                [data.workerId]: {
                  status: data.status || "assigned",
                  totalAccumulatedSeconds: data.totalAccumulatedSeconds || 0,
                  lastStartedAt: data.lastStartedAt || null,
                  workerComment: data.workerComment || "",
                  submittedAt: data.submittedAt || null
                }
              };
            }
            
            setJob(processedJob);
            
            // ログインしている「あなた（自分自身）」専用 of 枠から、保存済みのメモを復元します
            if (processedJob.workers?.[user.uid]) {
              setWorkerComment(processedJob.workers[user.uid].workerComment || "");
            }
          }

          const wishSnap = await getDoc(doc(db, "wishlists", `${user.uid}_${id}`));
          setIsWished(wishSnap.exists());
        } catch (error) { 
          console.error("データ取得エラー:", error); 
        } finally { 
          setLoading(false);
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [id, router]);

  // 時間を時・分・秒のきれいな文字列に変換する関数
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  // 开始された「時刻」を見やすくフォーマットする関数
  const formatStartTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    const s = String(date.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // クリップボードへの一撃コピー関数
  const handleCopyToClipboard = (text: string, fieldName: string) => {
    if (!text || text === "-") return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 1000); 
    }).catch(err => console.error("コピー失敗:", err));
  };

  const handleToggleWish = async () => {
    if (!currentUser || !job) return;
    
    const wishRef = doc(db, "wishlists", `${currentUser.uid}_${job.id}`);
    try {
      if (isWished) {
        await deleteDoc(wishRef);
        setIsWished(false);
      } else {
        await setDoc(wishRef, {
          workerId: currentUser.uid,
          jobId: job.id,
          createdAt: new Date()
        });
        setIsWished(true);
      }
    } catch (e) {
      console.error("ウィッシュリスト登録エラー:", e);
    }
  };

  // テキストエリアの内容をワーカー個別のカルテ領域へ一時保存する関数
  const handleSaveComment = async () => {
    if (!job || !currentUser) return;
    setIsSavingComment(true);
    try {
      const jobRef = doc(db, "jobs", job.id);
      
      // 💡 案件の全体メモではなく、自分専用のカルテ（workers > 自分のID > workerComment）を狙い撃ちで保存します
      await updateDoc(jobRef, {
        [`workers.${currentUser.uid}.workerComment`]: workerComment,
        updatedAt: serverTimestamp()
      });

      setJob((prev: any) => ({
        ...prev,
        workers: {
          ...prev.workers,
          [currentUser.uid]: {
            ...prev.workers?.[currentUser.uid],
            workerComment: workerComment
          }
        }
      }));
      
      triggerModal("save_success");
    } catch (e) {
      console.error("コメントの一時保存に失敗しました:", e);
      alert("保存に失敗しました。");
    } finally {
      setIsSavingComment(false);
    }
  };

  // ポップアップを起動する窓口
  const triggerModal = (type: "accept" | "start" | "pause" | "complete" | "save_success") => {
    setModalActionType(type);
    if (type === "accept") {
      setModalTitle("📥 案件を引き受ける");
      setModalMessage("この案件の担当メンバーとして登録しますか？\n確定すると『進行中のタスク』に移動し、いつでも作業を開始できるようになります。");
    } else if (type === "start") {
      setModalTitle("⏱️ 作業を開始する");
      setModalMessage("これより作業を開始します。よろしいですか？\n※あなた個人の『開始時刻』が個別に記録・集計されます。");
    } else if (type === "pause") {
      setModalTitle("⏸️ 作業を一時中断する");
      setModalMessage("休憩や中断のため、タイマーを停止しますか？\n※あなた個人のこれまでの稼働時間が集計され、実績に合算保存されます。");
    } else if (type === "complete") {
      setModalTitle("🏁 完了報告を提出する");
      setModalMessage("本日の作業をすべて終了し、オーナーへ提出しますか？\n\n※あなた以外の受託メンバーが全員完了報告を出し終えた時点で、案件全体が自動的に『検収待ち』状態へと移行します。");
    }
    else if (type === "save_success") {
      setModalTitle("✨ メモ一時保存完了");
      setModalMessage("報告コメント・作業メモをあなた専用のデータ枠へ安全に一時保存しました！\n\nこの内容はいつでも書き換え可能で、『作業を完了する』ボタンを押した際に最終実績としてオーナーへ自動提出されます。");
    }
    setModalOpen(true);
  };

  // ポップアップ内で「はい、実行する」を押したときの確定処理
  const handleModalConfirm = async () => {
    setModalOpen(false);
    if (!modalActionType || !job || !currentUser) return;

    setSubmitting(true);
    try {
      const jobRef = doc(db, "jobs", job.id);
      const now = new Date();

      const myData = job.workers?.[currentUser.uid] || {
        status: "assigned",
        totalAccumulatedSeconds: 0,
        lastStartedAt: null,
        workerComment: "",
        submittedAt: null
      };

      const currentWorkerCount = job.workers ? Object.keys(job.workers).length : 0;
      const limit = job.workerLimit || 1;

      if (modalActionType === "accept") {
        if (currentWorkerCount >= limit) {
          alert("申し訳ありません。この案件はすでに募集定員（上限人数）に達したため受諾できません。");
          setSubmitting(false);
          return;
        }

        const newWorkerCount = currentWorkerCount + 1;
        const isNowFull = newWorkerCount >= limit;

        const finalOverallStatus = isNowFull ? "assigned" : "open";

        await updateDoc(jobRef, {
          [`workers.${currentUser.uid}`]: {
            status: "assigned",
            totalAccumulatedSeconds: 0,
            lastStartedAt: null,
            workerComment: "",
            assignedAt: new Date()
          },
          workerId: job.workerId || currentUser.uid,
          status: finalOverallStatus, 
          updatedAt: serverTimestamp()
        });
        const snap = await getDoc(jobRef);
        setJob({ id: snap.id, ...snap.data() });
      } 
      
      else if (modalActionType === "start") {
        const isFull = currentWorkerCount >= limit;
        const finalOverallStatus = isFull ? "working" : "open";

        await updateDoc(jobRef, {
          [`workers.${currentUser.uid}.status`]: "working",
          [`workers.${currentUser.uid}.lastStartedAt`]: serverTimestamp(),
          status: finalOverallStatus,
          updatedAt: serverTimestamp()
        });
        const snap = await getDoc(jobRef);
        setJob({ id: snap.id, ...snap.data() });
      } 
      
      else if (modalActionType === "pause") {
        const isFull = currentWorkerCount >= limit;
        const finalOverallStatus = isFull ? "paused" : "open";

        const baseSeconds = myData.totalAccumulatedSeconds || 0;
        let finalSeconds = baseSeconds;
        let sessionSeconds = 0;

        if (myData.lastStartedAt) {
          const startedTime = myData.lastStartedAt.toDate 
            ? myData.lastStartedAt.toDate().getTime() 
            : new Date(myData.lastStartedAt).getTime();
          
          sessionSeconds = Math.floor((now.getTime() - startedTime) / 1000);
          finalSeconds = Math.max(baseSeconds, baseSeconds + sessionSeconds);
        }

        await updateDoc(jobRef, {
          [`workers.${currentUser.uid}.status`]: "paused",
          [`workers.${currentUser.uid}.totalAccumulatedSeconds`]: finalSeconds,
          status: finalOverallStatus, 
          updatedAt: serverTimestamp()
        });

        if (sessionSeconds > 0) {
          await addDoc(collection(db, "workLogs"), {
            workerId: currentUser.uid,
            jobId: job.id,
            jobTitle: job.title || "",
            seconds: sessionSeconds,
            timestamp: serverTimestamp()
          });
        }

        const snap = await getDoc(jobRef);
        setJob({ id: snap.id, ...snap.data() });
      } 
      
      else if (modalActionType === "complete") {
        const isFull = currentWorkerCount >= limit;
        const baseSeconds = myData.totalAccumulatedSeconds || 0;
        let finalSeconds = baseSeconds;
        let sessionSeconds = 0;

        if (myData.lastStartedAt) {
          const startedTime = myData.lastStartedAt.toDate 
            ? myData.lastStartedAt.toDate().getTime() 
            : new Date(myData.lastStartedAt).getTime();
          
          sessionSeconds = Math.floor((now.getTime() - startedTime) / 1000);
          finalSeconds = Math.max(baseSeconds, baseSeconds + sessionSeconds);
        }

        const allWorkersUids = Object.keys(job.workers || {});
        const otherWorkersUids = allWorkersUids.filter(uid => uid !== currentUser.uid);
        
        const isAllOthersFinished = otherWorkersUids.every(uid => {
          const status = job.workers[uid]?.status;
          return status === "review" || status === "completed";
        });

        let finalJobStatus = "working";
        if (otherWorkersUids.length === 0 || isAllOthersFinished) {
          finalJobStatus = "review";
        } else {
          finalJobStatus = isFull ? "working" : "open";
        }

        const updateData: any = {
          [`workers.${currentUser.uid}.status`]: "review",
          [`workers.${currentUser.uid}.totalAccumulatedSeconds`]: finalSeconds,
          [`workers.${currentUser.uid}.workerComment`]: workerComment, 
          [`workers.${currentUser.uid}.submittedAt`]: serverTimestamp(),
          status: finalJobStatus, 
          updatedAt: serverTimestamp()
        };

        if (finalJobStatus === "review") {
          updateData.submittedAt = serverTimestamp();
          updateData.workerComment = workerComment; 
        }

        await updateDoc(jobRef, updateData);

        if (sessionSeconds > 0) {
          await addDoc(collection(db, "workLogs"), {
            workerId: currentUser.uid,
            jobId: job.id,
            jobTitle: job.title || "",
            seconds: sessionSeconds,
            timestamp: serverTimestamp()
          });
        }

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

  const isMyJob = job.workers && Object.keys(job.workers).includes(currentUser?.uid);
  const myJobData = job.workers?.[currentUser?.uid];
  const myStatus = myJobData?.status || "open";

  const backUrl = (isMyJob && myStatus !== "open") ? "/worker/my-jobs" : "/worker/jobs";
  const backText = (isMyJob && myStatus !== "open") ? "🔙 進行中のタスク一覧に戻る" : "🔙 案件を探す（一覧）に戻る";

  const currentAssignedCount = job.workers ? Object.keys(job.workers).length : 0;
  const workerLimit = job.workerLimit || 1;

  // 💡【新設ロジック】自分以外の請負メンバーの中に、すでに「完了」した人がいるか自動チェック
  const otherWorkersUids = job.workers ? Object.keys(job.workers).filter(uid => uid !== currentUser?.uid) : [];
  const hasFinishedWorker = otherWorkersUids.some(uid => {
    const status = job.workers[uid]?.status;
    return status === "review" || status === "completed";
  });

  return (
    <WorkerShell title="案件詳細" subTitle="業務内容の確認と打刻">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-full mx-auto pb-32 text-slate-900 font-sans antialiased">
        
        {/* 左側メイン情報 */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center bg-white border-2 border-slate-300 p-3 rounded shadow-sm">
            <button 
              type="button"
              onClick={() => router.push(backUrl)} 
              className="bg-slate-100 border-2 border-slate-400 hover:bg-slate-200 text-slate-800 text-[11px] font-black px-4 py-1.5 rounded transition-all active:scale-95 shadow-sm"
            >
              {backText}
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

          <div className="bg-white border-2 border-slate-300 rounded p-4 shadow-sm relative group">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-base font-black tracking-tight text-slate-950 leading-snug flex-1">{job.title}</h1>
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard(job.title, "title")}
                  className="bg-slate-50 hover:bg-slate-200 text-slate-500 border border-slate-300 rounded p-1 text-[10px] font-black transition-all shadow-sm flex items-center gap-1 active:scale-95"
                  title="タイトルをコピー"
                >
                  📋 <span className="text-[9px] text-slate-600 font-black">COPY</span>
                </button>
                {copiedField === "title" && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-950 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-md whitespace-nowrap">
                    コピーしました！
                  </span>
                )}
              </div>
            </div>
          </div>

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

            <div className="p-3 flex flex-col justify-between min-h-[72px] relative group">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">SCクライアント</span>
              <div className="flex items-center justify-between gap-2 mt-auto w-full">
                <p className="text-xs font-black text-slate-900 truncate flex-1">{job.scClient || "-"}</p>
                {job.scClient && job.scClient !== "-" && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyToClipboard(job.scClient, "scClient")}
                      className="bg-slate-50 hover:bg-slate-200 text-slate-500 border border-slate-300 rounded px-1.5 py-0.5 text-[9px] font-black transition-all active:scale-95"
                      title="クライアント名をコピー"
                    >
                      📋
                    </button>
                    {copiedField === "scClient" && (
                      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-950 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-md whitespace-nowrap">
                        コピー完了！
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 flex flex-col justify-between min-h-[72px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">関連リンク</span>
              <div className="mt-auto flex justify-between items-center">
                <span className="text-[11px] text-[#5CA685] font-black">下部にパッケージ集約 📦</span>
              </div>
            </div>
            
            <div className="p-3 flex flex-col justify-between min-h-[72px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">予定作業件数</span>
              <p className="text-xs font-black text-slate-900 font-mono text-right mt-auto">{job.count || 0} 件</p>
            </div>
          </div>

          {/* 業務詳細リンク集パッケージ */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-3 shadow-sm">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#5CA685] pl-2">
              🔗 業務詳細（各種リンク設定）
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
              {job.jobType === "form_posting" ? (
                <>
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold">
                    <span className="text-slate-600">📄 送信文面内容</span>
                    {job.formContent ? (
                      <a href={job.formContent} target="_blank" rel="noopener noreferrer" className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">
                        本文を開く ↗
                      </a>
                    ) : <span className="text-slate-300 font-normal">未登録</span>}
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold">
                    <span className="text-slate-600">📋 入力情報リスト</span>
                    {job.inputInfo ? (
                      <a href={job.inputInfo} target="_blank" rel="noopener noreferrer" className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">
                        指示書を開く ↗
                      </a>
                    ) : <span className="text-slate-300 font-normal">未登録</span>}
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold">
                    <span className="text-slate-600 truncate max-w-[130px]">
                      🔗 {job.additionalLinkTitle || "その他追加リンク"}
                    </span>
                    {job.additionalLinkUrl ? (
                      <a href={job.additionalLinkUrl} target="_blank" rel="noopener noreferrer" className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">
                        リンクを開く ↗
                      </a>
                    ) : <span className="text-slate-300 font-normal">未登録</span>}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold">
                    <span className="text-slate-600">🌐 抽出ターゲットサイト</span>
                    {job.siteUrl ? (
                      <a href={job.siteUrl} target="_blank" rel="noopener noreferrer" className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">
                        サイトを開く ↗
                      </a>
                    ) : <span className="text-slate-300 font-normal">未登録</span>}
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold">
                    <span className="text-slate-600">📋 入力項目（指示書等）</span>
                    {job.targetItems ? (
                      <a href={job.targetItems} target="_blank" rel="noopener noreferrer" className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">
                        指示書を開く ↗
                      </a>
                    ) : <span className="text-slate-300 font-normal">未登録</span>}
                  </div>
                </>
              )}
            </div>
          </div>

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

          {/* 報告コメント / 作業メモ入力 */}
          {isMyJob && (
            <div className="bg-emerald-50/30 border-2 border-emerald-400/60 rounded p-4 space-y-2.5 shadow-md transition-all animate-fade-in">
              <h2 className="text-xs font-black text-emerald-950 uppercase tracking-wider border-l-4 border-[#5CA685] pl-2 flex items-center gap-1.5 select-none">
                💬 報告コメント / 作業メモ入力
              </h2>
              <p className="text-[10px] text-emerald-800/80 font-bold leading-relaxed select-none">
                ※作業中に気づいた点やオーナーへの引き継ぎ内容をいつでも自由にメモ・一時保存できます。ここに書いた内容は、右の「作業を完了する」ボタンを押したときに最終実績として自動提出されます。
              </p>
              <textarea
                value={workerComment}
                onChange={(e) => setWorkerComment(e.target.value)}
                disabled={myStatus === "review" || myStatus === "completed"}
                placeholder="例：50件目までフォーム送信完了しました。一部のアドレスがエラーだったため、SC上でスキップ処理を入れています。稼働ログに残らない特記事項など、自由にメモにご活用ください！"
                rows={4}
                className="w-full border-2 border-emerald-200 rounded p-2.5 text-xs font-bold outline-none focus:border-[#5CA685] focus:ring-2 focus:ring-emerald-100 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 resize-y shadow-inner transition-all"
              />
              {(myStatus === "assigned" || myStatus === "working" || myStatus === "paused") && (
                <div className="flex justify-end pt-0.5">
                  <button
                    type="button"
                    onClick={handleSaveComment}
                    disabled={isSavingComment}
                    className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-4 py-2 rounded border border-black/10 shadow-md transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSavingComment ? "保存中..." : "💾 コメントを一時保存する"}
                  </button>
                </div>
              )}
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
              {/* 受託枠インジケーター */}
              <div className="bg-slate-100 border border-slate-300 p-2.5 rounded text-[11px] font-bold text-slate-600 flex justify-between items-center select-none">
                <span>👥 現在の受託状況:</span>
                <span className="font-mono text-xs font-black text-[#5CA685]">
                  {currentAssignedCount} / {workerLimit} 名（定員）
                </span>
              </div>

              {/* 💡【新設機能】他の請負メンバーが先に完了報告を提出している場合のリアルタイムアラート表示 */}
              {isMyJob && hasFinishedWorker && (myStatus === "assigned" || myStatus === "working" || myStatus === "paused") && (
                <div className="bg-amber-50 border border-amber-300 p-2.5 rounded text-[11px] font-bold text-amber-800 flex items-start gap-1.5 shadow-sm animate-pulse select-none">
                  <span className="text-xs">💡</span>
                  <span>
                    同じ案件を請け負っている別メンバーが、先に完了報告を提出しています。
                  </span>
                </div>
              )}

              <div className="bg-slate-50 border-2 border-slate-200 p-3 rounded text-center">
                <div className={`text-sm font-black ${myStatus === 'working' ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
                  {myStatus === 'open' ? '🔓 未受諾（募集中）' : 
                   myStatus === 'assigned' ? '📥 受諾済み（準備中）' : 
                   myStatus === 'working' ? '🔴 現在稼働中' : 
                   myStatus === 'paused' ? '⏸️ 一時停止中' : 
                   myStatus === 'review' ? '⌛ オーナー検収待ち' : myStatus}
                </div>
              </div>

              {/* 積算時間ボード */}
              {(myStatus === "assigned" || myStatus === "working" || myStatus === "paused" || myStatus === "review") && (
                <div className="p-4 bg-emerald-50/40 border-2 border-emerald-200 text-slate-900 rounded font-sans shadow-inner space-y-3.5">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">ACCUMULATED TIME / あなたの積算時間</span>
                    <p className="text-xl font-black text-[#5CA685] tracking-tight font-mono tabular-nums">
                      {formatTime(myJobData?.totalAccumulatedSeconds || 0)}
                    </p>
                  </div>
                  
                  {myStatus === "working" && myJobData?.lastStartedAt && (
                    <div className="border-t border-emerald-200 pt-2.5">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">START TIME / 今回の開始時刻</span>
                      <p className="text-xs font-bold text-slate-600 tracking-wide">
                        📅 <span className="font-mono bg-white px-1 py-0.5 rounded border border-slate-300 text-slate-800">{formatStartTime(myJobData.lastStartedAt)}</span> から継続中
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {myStatus === 'open' && (
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
                    disabled={submitting || currentAssignedCount >= workerLimit}
                    className="w-full py-3 bg-[#5CA685] hover:bg-[#4A9272] text-white text-xs font-black rounded border border-black/10 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {currentAssignedCount >= workerLimit ? '❌ 定員に達したため締め切られました' : 'この案件を引き受ける'}
                  </button>
                ) : (
                  <>
                    {myStatus === "assigned" && (
                      <button 
                        type="button" 
                        onClick={() => triggerModal("start")}
                        disabled={submitting}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded border border-black/10 transition-colors shadow-sm"
                      >
                        ⏱️ 作業を開始する
                      </button>
                    )}

                    {myStatus === "paused" && (
                      <button 
                        type="button" 
                        onClick={() => triggerModal("start")}
                        disabled={submitting}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded border border-black/10 transition-colors shadow-sm"
                      >
                        ▶️ 作業を再開する
                      </button>
                    )}

                    {myStatus === "working" && (
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

                    {myStatus === "review" && (
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

      {/* シンプルモダンデザインモーダル */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            <div className="bg-[#5CA685] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>{modalTitle}</span>
            </div>

            <div className="p-6 bg-white">
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                {modalMessage}
              </p>
            </div>

            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              {modalActionType === "save_success" ? (
                <button
                  type="button"
                  onClick={() => { setModalOpen(false); setModalActionType(null); }}
                  className="px-6 py-2 bg-[#5CA685] hover:bg-[#4A9272] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
                >
                  OK
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide"
                  >
                    いいえ
                  </button>
                  <button
                    type="button"
                    onClick={handleModalConfirm}
                    className="px-4 py-2 bg-[#5CA685] hover:bg-[#4A9272] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
                  >
                    はい、実行する
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

    </WorkerShell>
  );
}