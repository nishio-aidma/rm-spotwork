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
          // 作業中状態であれば累積秒数を初期化
          if (data.status === "working") {
            setSeconds(data.totalAccumulatedSeconds || 0);
          }
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }
    fetchData();
  }, [params.id]);

  // タイマー処理：ステータスが「作業中」の時のみ1秒ずつ加算
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

  // 【確認ポップアップ】案件を引き受ける
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

  // 【確認ポップアップ】作業開始
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

  // 一時停止
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

  // 【確認ポップアップ】作業完了
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
      router.push("/worker/my-jobs");
    } catch (e) {
      alert("完了報告に失敗しました。");
    } finally { setSubmitting(false); }
  };

  if (loading) return <WorkerShell title="読み込み中"><div className="p-10 text-center text-slate-400 text-sm">データを取得中...</div></WorkerShell>;
  if (!job) return <WorkerShell title="エラー"><div className="p-10 text-center text-sm">案件が見つかりませんでした。</div></WorkerShell>;

  const isMyJob = job.workerId === auth.currentUser?.uid;

  return (
    <WorkerShell title="案件詳細" subTitle={job.title}>
      <div className="max-w-4xl mx-auto pb-32 text-slate-700">
        
        {/* 1. 戻るリンク */}
        <div className="mb-10 pt-4">
          <button onClick={() => router.back()} className="text-sm text-slate-400 hover:text-slate-800 transition-colors flex items-center gap-1">
            ← 案件一覧に戻る
          </button>
        </div>

        {/* 2. 案件名 */}
        <div className="mb-12">
          <div className="flex gap-2 mb-4">
            <span className="text-[11px] font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
              {job.jobType === 'form_posting' ? 'フォーム投稿' : 'リスト作成'}
            </span>
            {job.urgency === "3" && <span className="text-[11px] font-bold px-2 py-0.5 bg-red-50 text-red-500 rounded border border-red-100">至急</span>}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 leading-tight">{job.title}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-16 items-start">
          
          {/* 左側：メイン情報 */}
          <div className="lg:col-span-2 space-y-12">
            
            <section className="space-y-6">
              <h2 className="text-base font-bold text-slate-900">案件内容</h2>
              <div className="border-t border-slate-200 pt-6 space-y-8">
                {job.jobType === "form_posting" ? (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400">送信文面</label>
                    <div className="text-sm leading-relaxed text-slate-600 bg-slate-50 p-6 rounded-md whitespace-pre-wrap">
                      {job.formContent || "未入力"}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400">参照サイトURL</label>
                    <div className="mt-1">
                      <a href={job.siteUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 underline break-all">
                        {job.siteUrl || "URLなし"}
                      </a>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-8 border-t border-slate-100 pt-8">
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-2 block">抽出項目 / 入力情報</label>
                    <p className="text-sm font-medium">{job.targetItems || job.inputInfo || "指定なし"}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-2 block">期限 / 報酬</label>
                    <p className="text-sm font-medium">
                      {job.deadline || "なし"} / <span className="text-blue-600">¥{job.reward?.toLocaleString()}</span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-base font-bold text-slate-900">具体的な作業手順</h2>
              <div className="border-t border-slate-200 pt-4 divide-y divide-slate-100">
                {Array.isArray(job.procedures) && job.procedures.length > 0 ? (
                  job.procedures.map((step, i) => (
                    <div key={i} className="py-4 flex gap-6 items-start group">
                      <span className="text-xs font-medium text-slate-300 pt-0.5">{i + 1}</span>
                      <p className="text-sm text-slate-600 leading-relaxed">{step}</p>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-sm text-slate-400 italic">手順の指定はありません。</p>
                )}
              </div>
            </section>
          </div>

          {/* 右側：コントロールパネル（Notion風にシンプルに） */}
          <aside className="sticky top-10 space-y-6">
            <div className="border border-slate-200 rounded-lg p-6 bg-white">
              <div className="mb-8">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">現在の状態</label>
                <div className="text-sm font-bold text-slate-800">
                  {job.status === 'open' ? '未受諾' : 
                   job.status === 'assigned' ? '請負済み' : 
                   job.status === 'working' ? '現在作業中' : 
                   job.status === 'paused' ? '一時停止中' : 
                   job.status === 'review' ? '検収待ち' : job.status}
                </div>
              </div>

              {/* タイマー表示 */}
              {(job.status === "working" || job.status === "paused") && (
                <div className="mb-8 p-4 bg-slate-50 border border-slate-100 rounded-md">
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">経過時間</label>
                  <p className="text-lg font-bold text-blue-600 tabular-nums">{formatTime(seconds)}</p>
                </div>
              )}

              <div className="space-y-3">
                {!isMyJob ? (
                  <button 
                    onClick={handleAcceptJob} 
                    disabled={submitting}
                    className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                    案件を引き受ける
                  </button>
                ) : (
                  <>
                    {(job.status === "assigned" || job.status === "paused") && (
                      <button 
                        onClick={handleStartWork} 
                        disabled={submitting}
                        className="w-full py-2.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        作業を開始する
                      </button>
                    )}
                    {job.status === "working" && (
                      <div className="space-y-2">
                        <button 
                          onClick={handlePauseWork} 
                          disabled={submitting}
                          className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold rounded hover:bg-slate-50 transition-colors"
                        >
                          一時停止する
                        </button>
                        <button 
                          onClick={handleCompleteWork} 
                          disabled={submitting}
                          className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 transition-colors"
                        >
                          作業完了・報告する
                        </button>
                      </div>
                    )}
                    {job.status === "review" && (
                      <div className="p-4 bg-amber-50 border border-amber-100 rounded-md text-center">
                        <span className="text-[11px] font-bold text-amber-700">検収待ち</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            
            <p className="text-[10px] text-slate-400 leading-relaxed px-1">
              作業を開始するとタイマーが稼働します。完了報告を行うと、オーナーに通知され検収が行われます。
            </p>
          </aside>

        </div>
      </div>
    </WorkerShell>
  );
}