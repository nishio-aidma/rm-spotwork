"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import WorkerShell from "@/components/WorkerShell";

export default function WorkerJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // タイマー管理
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchData() {
      const user = auth.currentUser;
      if (!params.id || !user) return;
      try {
        const docRef = doc(db, "jobs", params.id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setJob({ id: snap.id, ...data });
          if (data.status === "working") {
            setSeconds(data.totalAccumulatedSeconds || 0);
          }
        }
      } catch (error) { 
        console.error(error); 
      } finally { 
        setLoading(false); 
      }
    }
    fetchData();
  }, [params.id]);

  // タイマー処理
  useEffect(() => {
    if (job?.status === "working") {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [job?.status]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}時間 ${m}分 ${sec}秒`;
  };

  const handleAcceptJob = async () => {
    const ok = window.confirm("この案件を引き受けますか？\n引き受けると、あなたの「進行中のタスク」に追加されます。");
    if (!ok) return;

    setSubmitting(true);
    try {
      const jobRef = doc(db, "jobs", job.id);
      await updateDoc(jobRef, {
        workerId: auth.currentUser?.uid,
        status: "assigned",
        updatedAt: serverTimestamp()
      });
      const snap = await getDoc(jobRef);
      setJob({ id: snap.id, ...snap.data() });
    } catch (e) {
      alert("受諾処理に失敗しました。");
    } finally { setSubmitting(false); }
  };

  const handleStartWork = async () => {
    const ok = window.confirm("作業を開始し、時間の計測を始めますか？");
    if (!ok) return;

    setSubmitting(true);
    try {
      const jobRef = doc(db, "jobs", job.id);
      await updateDoc(jobRef, {
        status: "working",
        updatedAt: serverTimestamp()
      });
      const snap = await getDoc(jobRef);
      setJob({ id: snap.id, ...snap.data() });
    } catch (e) {
      alert("開始処理に失敗しました。");
    } finally { setSubmitting(false); }
  };

  const handlePauseWork = async () => {
    setSubmitting(true);
    try {
      const jobRef = doc(db, "jobs", job.id);
      await updateDoc(jobRef, {
        status: "paused",
        totalAccumulatedSeconds: seconds,
        updatedAt: serverTimestamp()
      });
      const snap = await getDoc(jobRef);
      setJob({ id: snap.id, ...snap.data() });
    } catch (e) {
      alert("一時停止に失敗しました。");
    } finally { setSubmitting(false); }
  };

  const handleCompleteWork = async () => {
    const ok = window.confirm("作業を完了し、オーナーへ検収を依頼しますか？\nこの操作は取り消せません。");
    if (!ok) return;

    setSubmitting(true);
    try {
      const jobRef = doc(db, "jobs", job.id);
      await updateDoc(jobRef, {
        status: "review",
        totalAccumulatedSeconds: seconds,
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      // マイタスクへ移動
      router.push("/worker/my-jobs");
    } catch (e) {
      alert("完了報告に失敗しました。");
    } finally { setSubmitting(false); }
  };

  if (loading) return <WorkerShell title="読み込み中"><div className="p-10 text-center text-slate-400 text-sm">データを取得中...</div></WorkerShell>;
  if (!job) return <WorkerShell title="エラー"><div className="p-10 text-center text-sm">案件が見つかりませんでした。</div></WorkerShell>;

  const isMyJob = job.workerId === auth.currentUser?.uid;

  return (
    <WorkerShell title="案件詳細" subTitle="業務内容の確認と計測">
      <div className="max-w-5xl mx-auto pb-32 text-slate-800">
        
        {/* 1. 戻るリンク */}
        <div className="mb-10">
          <button onClick={() => router.back()} className="text-[10px] font-bold text-slate-400 hover:text-slate-900 transition-all flex items-center gap-1 uppercase tracking-widest">
            ← 案件一覧へ戻る
          </button>
        </div>

        {/* 2. ヘッダーエリア */}
        <div className="mb-12 border-b border-slate-100 pb-8">
          <div className="flex gap-2 mb-4">
            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 text-slate-500 rounded border border-slate-200">
              {job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}
            </span>
            {job.urgency === "3" && <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-50 text-rose-500 rounded border border-rose-100 uppercase">至急</span>}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-snug">{job.title}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          
          {/* 左側：メイン情報 */}
          <div className="lg:col-span-2 space-y-12">
            
            <section className="space-y-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-l-4 border-slate-900 pl-3">案件内容</h2>
              <div className="pt-2 space-y-8">
                {/* 案件タイプによる指示内容の切り替え */}
                {job.jobType === "form_posting" ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">送信文面 / メッセージ</label>
                    <div className="text-sm leading-relaxed text-slate-700 bg-slate-50 p-6 rounded-xl border border-slate-100 whitespace-pre-wrap">
                      {job.formContent || "文面の指定はありません。"}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">参照サイトURL</label>
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 overflow-hidden">
                      <a href={job.siteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-600 hover:text-indigo-800 underline break-all flex items-center gap-2">
                        {job.siteUrl || "URLの指定はありません。"} <span>↗</span>
                      </a>
                    </div>
                  </div>
                )}
                
                {/* グリッド型情報（募集人数を追加） */}
                <div className="grid grid-cols-3 gap-8 border-t border-slate-50 pt-8">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">抽出 / 入力情報</label>
                    <p className="text-sm font-bold">{job.targetItems || job.inputInfo || "指定なし"}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">募集人数</label>
                    <p className="text-sm font-bold text-slate-800">{job.workerLimit || 1} 名</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">報酬 / 件数</label>
                    <p className="text-sm font-bold">
                      <span className="text-indigo-600">¥{job.reward?.toLocaleString()}</span> / {job.count || "-"}件
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-l-4 border-slate-900 pl-3">作業手順</h2>
              <div className="space-y-3">
                {Array.isArray(job.procedures) && job.procedures.length > 0 ? (
                  job.procedures.map((step, i) => (
                    <div key={i} className="flex gap-4 items-center bg-white border border-slate-100 p-4 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-300">0{i + 1}</span>
                      <p className="text-sm font-medium text-slate-700">{step || "未設定"}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic py-4">手順の指定はありません。</p>
                )}
              </div>
            </section>
          </div>

          {/* 右側：コントロールパネル */}
          <aside className="sticky top-10 space-y-6">
            <div className="border border-slate-200 rounded-2xl p-6 bg-white shadow-sm">
              <div className="mb-8">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">ステータス</label>
                <div className="text-sm font-bold text-slate-800">
                  {job.status === 'open' ? '募集中の案件' : 
                   job.status === 'assigned' ? '受諾済み・準備中' : 
                   job.status === 'working' ? '🔴 作業計測中' : 
                   job.status === 'paused' ? '⏸️ 一時停止中' : 
                   job.status === 'review' ? '⌛ 検収待ち' : job.status}
                </div>
              </div>

              {/* タイマー表示 */}
              {(job.status === "working" || job.status === "paused") && (
                <div className="mb-8 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">計測時間</label>
                  <p className="text-xl font-bold text-indigo-600 tabular-nums">{formatTime(seconds)}</p>
                </div>
              )}

              <div className="space-y-3">
                {!isMyJob ? (
                  <button 
                    onClick={handleAcceptJob} 
                    disabled={submitting}
                    className="w-full py-3 bg-slate-900 text-white text-[11px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-md disabled:opacity-50"
                  >
                    案件を引き受ける
                  </button>
                ) : (
                  <>
                    {(job.status === "assigned" || job.status === "paused") && (
                      <button 
                        onClick={handleStartWork} 
                        disabled={submitting}
                        className="w-full py-3 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md"
                      >
                        作業を開始する
                      </button>
                    )}
                    {job.status === "working" && (
                      <div className="space-y-2">
                        <button 
                          onClick={handlePauseWork} 
                          disabled={submitting}
                          className="w-full py-3 bg-white border border-slate-200 text-slate-600 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-all"
                        >
                          一時停止する
                        </button>
                        <button 
                          onClick={handleCompleteWork} 
                          disabled={submitting}
                          className="w-full py-3 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-md"
                        >
                          作業完了を報告
                        </button>
                      </div>
                    )}
                    {job.status === "review" && (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-center">
                        <span className="text-[11px] font-bold text-amber-700">検収待ちの状態です</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 leading-relaxed px-1">
              ※作業完了を報告するとオーナーに通知されます。検収が完了すると報酬が確定します。
            </p>
          </aside>

        </div>
      </div>
    </WorkerShell>
  );
}