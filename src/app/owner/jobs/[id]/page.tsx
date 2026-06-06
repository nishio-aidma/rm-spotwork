"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

interface OwnerJobDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OwnerJobDetailPage({ params }: OwnerJobDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 💡シンプルモダン確認ポップアップ用の管理ステート
  const [modalOpen, setModalOpen] = useState(false);
  // 💡どのアクション（下書き戻し or 検収承認）を呼ぶかを識別するステート
  const [modalType, setModalType] = useState<"draft" | "approve" | null>(null);

  useEffect(() => {
    async function fetchJob() {
      if (!id || !user) return;
      try {
        const docRef = doc(db, "jobs", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setJob({ id: snap.id, ...snap.data() });
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchJob();
  }, [id, user, authLoading]);

  // 時間テキスト変換
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  // 💡ポップアップを起動する窓口
  const triggerModal = (type: "draft" | "approve") => {
    setModalType(type);
    setModalOpen(true);
  };

  // 💡【確定処理】カスタムポップアップ内から実行される選択ロジック
  const handleModalConfirm = async () => {
    const action = modalType;
    setModalOpen(false);
    setModalType(null);
    if (!job || !action) return;

    setSubmitting(true);
    try {
      const jobRef = doc(db, "jobs", job.id);

      if (action === "draft") {
        await updateDoc(jobRef, {
          status: "draft",
          updatedAt: serverTimestamp()
        });
        setJob((prev: any) => ({ ...prev, status: "draft" }));
        alert("案件を受諾募集停止にし、下書き状態へ戻しました。");
      } 
      
      else if (action === "approve") {
        await updateDoc(jobRef, {
          status: "completed",
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setJob((prev: any) => ({ ...prev, status: "completed" }));
        alert("案件を承認（検収完了）しました！");
      }
    } catch (e) {
      console.error(e);
      alert("処理に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) return <OwnerShell title="読み込み中..."><div className="p-10 text-center text-slate-400 text-xs font-bold">案件情報を照会中...</div></OwnerShell>;
  if (!job) return <OwnerShell title="エラー"><div className="p-10 text-center text-rose-600 font-bold text-xs">指定された案件が見つかりませんでした。</div></OwnerShell>;

  return (
    <OwnerShell title="案件詳細・管理デスク" subTitle="発注内容の確認とワーカー稼働状況の監視">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-full mx-auto pb-32 text-slate-900 font-sans antialiased">
        
        {/* 左側：メイン情報明細 */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex justify-between items-center bg-white border-2 border-slate-300 p-3 rounded shadow-sm">
            <button 
              type="button"
              onClick={() => router.push("/owner/jobs")} 
              className="bg-slate-100 border-2 border-slate-400 hover:bg-slate-200 text-slate-800 text-[11px] font-black px-4 py-1.5 rounded transition-all active:scale-95 shadow-sm"
            >
              🔙 案件管理（一覧）に戻る
            </button>
            <div className="flex gap-2">
              <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded font-bold text-[10px]">
                {job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}
              </span>
              {job.urgency === "3" && (
                <span className="text-[10px] font-black px-1.5 py-0.5 bg-rose-50 text-rose-700 rounded border border-rose-300 animate-pulse">至急</span>
              )}
            </div>
          </div>

          <div className="bg-white border-2 border-slate-300 rounded p-4 shadow-sm">
            <span className="text-[9px] font-mono text-slate-400 font-black block mb-1">JOB TITLE</span>
            <h1 className="text-base font-black tracking-tight text-slate-950 leading-snug">{job.title}</h1>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border-2 border-slate-300 rounded overflow-hidden divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-300 shadow-sm">
            <div className="p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">SCクライアント名</span>
              <p className="text-xs font-black text-slate-900 truncate mt-1">{job.scClient || "-"}</p>
            </div>
            <div className="p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                {job.jobType === 'form_posting' ? '送信文面指示書' : '抽出項目指示書'}
              </span>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{job.inputInfo || job.targetItems || "未登録"}</span>
                {(job.inputInfo || job.targetItems) && (
                  <a href={job.inputInfo || job.targetItems} target="_blank" rel="noopener noreferrer" className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-[10px] font-black px-2 py-0.5 rounded transition-colors shadow-sm whitespace-nowrap">開く ↗</a>
                )}
              </div>
            </div>
            <div className="p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">予定作業件数</span>
              <p className="text-xs font-black text-slate-900 font-mono text-right mt-1">{job.count || 0} 件</p>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#0082C8] pl-2">
              {job.jobType === "form_posting" ? "送信文面・内容データURL" : "抽出ターゲットサイトURL"}
            </h2>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded p-2 text-xs">
              <span className="font-mono text-slate-600 truncate max-w-md">{job.formContent || job.siteUrl || "URL指定なし"}</span>
              {(job.formContent || job.siteUrl) && (
                <a href={job.formContent || job.siteUrl} target="_blank" rel="noopener noreferrer" className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">リンク先を開く ↗</a>
              )}
            </div>
          </div>

          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-emerald-600 pl-2">設定された作業手順</h2>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded overflow-hidden">
              {Array.isArray(job.procedures) && job.procedures.length > 0 ? (
                job.procedures.map((step: string, i: number) => (
                  <div key={i} className="flex gap-3 items-center p-2.5 bg-white text-xs">
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 font-mono font-bold rounded">{i + 1}</span>
                    <p className="font-bold text-slate-800 flex-1">{step || "未設定"}</p>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-[10px] text-slate-400 italic">手順の手順指定はありません。</div>
              )}
            </div>
          </div>
        </div>

        {/* 右側：コントロールサイドインフラ */}
        <div className="lg:col-span-4 h-fit space-y-3">
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center select-none">
              <span className="text-xs font-black text-slate-700">案件統括ステータス</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">CONTROL</span>
            </div>

            <div className="p-4 space-y-4">
              <div className="bg-slate-50 border-2 border-slate-200 p-3 rounded text-center">
                <div className="text-xs font-black text-slate-800">
                  {job.status === 'open' ? '🔓 募集中（ワーカー未定）' : 
                   job.status === 'draft' ? '📋 下書き保存中（非公開）' : 
                   job.status === 'assigned' ? '📥 受諾済み（作業準備中）' : 
                   job.status === 'working' ? '🔴 ワーカー作業中（タイマー稼働）' : 
                   job.status === 'paused' ? '⏸️ 一時中断中' : 
                   job.status === 'review' ? '⌛ 検収待ち（報告提出済み）' : 
                   job.status === 'completed' ? '🏁 検収完了（取引終了）' : job.status}
                </div>
              </div>

              <div className="p-3.5 bg-blue-50/60 border border-blue-200 text-slate-900 rounded font-sans shadow-inner space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">TOTAL TIME / 累積稼働実績</span>
                <p className="text-xl font-black text-[#0082C8] tracking-tight font-mono tabular-nums">
                  {formatTime(job.totalAccumulatedSeconds || 0)}
                </p>
              </div>

              <div className="space-y-2">
                {/* 💡古い window.confirm ではなくカスタムモーダルを美しく起動 */}
                {job.status === "open" && (
                  <button 
                    type="button"
                    onClick={() => triggerModal("draft")}
                    disabled={submitting}
                    className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 border border-slate-400 text-slate-700 text-xs font-black rounded transition-colors text-center"
                  >
                    🔒 募集を停止して下書きに戻す
                  </button>
                )}

                {job.status === "review" && (
                  <button 
                    type="button"
                    onClick={() => triggerModal("approve")}
                    disabled={submitting}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded border border-black/10 shadow-md transition-colors"
                  >
                    ✓ 稼働時間を承認して検収完了にする
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => router.push(`/owner/jobs/${job.id}/edit`)}
                  className="w-full py-2 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-700 text-xs font-black rounded transition-colors text-center"
                >
                  ✏️ この案件を編集する
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 💡【超シンプル化リフォーム】フチ線や影を全撤去した極上シンプルデザインを適用 */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            {/* ポップアップヘッダー */}
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>{modalType === "draft" ? "🔒 募集停止の確認" : "✓ 案件の検収承認確認"}</span>
            </div>

            {/* ポップアップ本文 */}
            <div className="p-6 bg-white">
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                {modalType === "draft" 
                  ? "この案件の受諾募集を一度ストップし、非公開の『下書き状態』に戻しますか？\n\n戻すと、ワーカー側の案件を探す画面から一時的に表示が消えます。"
                  : "この案件の作業内容および稼働時間を承認（検収完了）しますか？\n\n確定するとステータスが『完了』となり、ワーカーの実績として確定します。"
                }
              </p>
            </div>

            {/* アクションボタン */}
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => { setModalOpen(false); setModalType(null); }}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                className={`px-4 py-2 text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm ${
                  modalType === "draft" ? "bg-[#0082C8] hover:bg-[#0072B5]" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {modalType === "draft" ? "はい、下書きに戻す" : "はい、承認する"}
              </button>
            </div>

          </div>
        </div>
      )}

    </OwnerShell>
  );
}