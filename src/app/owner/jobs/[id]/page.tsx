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

  // シンプルモダン確認ポップアップ用の管理ステート
  // 💡【仕様変更】"reject"（差し戻しアクション）を型に追加
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"draft" | "approve" | "publish" | "reject" | null>(null);

  // コピー完了通知用のポップステート
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 💡【新設】詳細画面側の公開モーダル用通知切り替えチェックボックス（デフォルトON）
  const [shouldNotify, setShouldNotify] = useState(true);

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
        loading && setLoading(false);
      }
    }
    if (!authLoading) fetchJob();
  }, [id, user, authLoading, loading]);

  // 時間テキスト変換
  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  // クリップボードへの一撃コピー関数
  const handleCopyToClipboard = (text: string, fieldName: string) => {
    if (!text || text === "-") return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 1000); 
    }).catch(err => console.error("コピーに失敗しました:", err));
  };

  // MEMBERSチャットグループへ案件公開の自動通知を撃ち込む関数
  const sendMembersNotification = async (targetJob: any) => {
    const token = process.env.NEXT_PUBLIC_MEMBERS_API_TOKEN;
    const roomId = process.env.NEXT_PUBLIC_MEMBERS_ROOM_ID;

    if (!token || !roomId) {
      console.warn("MEMBERSの通知設定（環境変数）が見つからないため、通知をスキップしました。");
      return;
    }

    try {
      const memberUrl = `https://api.mem-bars.jp/web-api/rooms/${roomId}/members`;
      const memberRes = await fetch(memberUrl, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      let allMemberIds = "";
      if (memberRes.ok) {
        const memberJson = await memberRes.json();
        if (memberJson?.member && Array.isArray(memberJson.member)) {
          allMemberIds = memberJson.member.map((m: any) => m.id).join(",");
        }
      }

      const jobUrl = `https://rm-spotwork.vercel.app/owner/jobs/${targetJob.id}`;
      const jobTypeName = targetJob.jobType === "form_posting" ? "✉️ フォーム投稿" : "📋 リスト作成";

      const messageBody = `🚀 【案件公開通知】新しい案件が公開されました！\n\n【案件タイトル】 ${targetJob.title || "未設定"}\n【仕事種別】 ${jobTypeName}\n【SCクライアント】 ${targetJob.scClient || "-"}\n【予定作業件数】 ${targetJob.count || 0} 件\n【指定納期】 ${targetJob.deadline || "未設定"}\n\n👇 案件の詳細確認・受諾はこちらから！\n${jobUrl}`;

      const postUrl = `https://api.mem-bars.jp/web-api/rooms/${roomId}/messages`;
      const formData = new FormData();
      formData.append("body", messageBody);
      if (allMemberIds) {
        formData.append("to_id", allMemberIds);
      }

      await fetch(postUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData
      });

      console.log("MEMBERSへの公開通知送信が完了しました。");
    } catch (error) {
      console.error("MEMBERSへの通知送信中にエラーが発生しました:", error);
    }
  };

  const triggerModal = (type: "draft" | "approve" | "publish" | "reject") => {
    if (type === "publish") {
      setShouldNotify(true); // 公開時はチェックボックスを初期化
    }
    setModalType(type);
    setModalOpen(true);
  };

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
      } 
      
      else if (action === "approve") {
        await updateDoc(jobRef, {
          status: "completed",
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        setJob((prev: any) => ({ ...prev, status: "completed" }));
      }

      else if (action === "publish") {
        await updateDoc(jobRef, {
          status: "open",
          updatedAt: serverTimestamp()
        });
        
        const updatedJob = { ...job, status: "open" };
        setJob(updatedJob);

        // 💡 チェックがついているときだけ通知を発動
        if (shouldNotify) {
          await sendMembersNotification(updatedJob);
        }
      }

      // 💡【新設】差し戻し確定処理
      else if (action === "reject") {
        await updateDoc(jobRef, {
          status: "assigned", // 受諾済み（作業準備中）に戻すことで、ワーカーが業務再開→再完了できるようにします
          updatedAt: serverTimestamp()
        });
        setJob((prev: any) => ({ ...prev, status: "assigned" }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicateJob = (isEditMode: boolean = false) => {
    if (!job) return;
    try {
      const duplicateData = {
        title: isEditMode ? (job.title || "") : `${job.title || ""} _コピー`,
        jobType: job.jobType || "form_posting",
        urgency: job.urgency || "1",
        scClient: job.scClient || "",
        count: job.count || 100,
        workerLimit: job.workerLimit || 1,
        deadline: job.deadline || "",
        inputInfo: job.inputInfo || "",
        targetItems: job.targetItems || "",
        formContent: job.formContent || "",
        siteUrl: job.siteUrl || "",
        procedures: Array.isArray(job.procedures) ? job.procedures : ["", "", ""],
        memo: job.memo || "" ,
        existingJobId: isEditMode ? job.id : null
      };
      
      sessionStorage.setItem("duplicate_job_base", JSON.stringify(duplicateData));
      router.push("/owner/jobs/new");
    } catch (e) {
      console.error("データの引き継ぎに失敗しました:", e);
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

          {/* 案件タイトル */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 shadow-sm relative group">
            <span className="text-[9px] font-mono text-slate-400 font-black block mb-1">JOB TITLE</span>
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-base font-black tracking-tight text-slate-950 leading-snug flex-1">{job.title}</h1>
              <div className="relative shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={() => handleCopyToClipboard(job.title, "title")}
                  className="bg-slate-50 hover:bg-slate-200 text-slate-500 border border-slate-300 rounded p-1 text-[11px] font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                  title="タイトルをコピー"
                >
                  📋 <span className="text-[9px] font-black text-slate-600">COPY</span>
                </button>
                {copiedField === "title" && (
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-950 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-md whitespace-nowrap">
                    コピーしました！
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 bg-white border-2 border-slate-300 rounded overflow-hidden divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-slate-300 shadow-sm">
            
            {/* SCクライアント名 */}
            <div className="p-3 flex flex-col justify-between min-h-[64px] relative group">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">SCクライアント名</span>
              <div className="flex items-center justify-between gap-2 mt-1 w-full">
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
            
            <div className="p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">入力情報</span>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{job.inputInfo || job.targetItems || "未登録"}</span>
                {(job.inputInfo || job.targetItems) && (
                  <a href={job.inputInfo || job.targetItems} target="_blank" rel="noopener noreferrer" className="bg-[#0082C8] hover:bg-[#0072B5] text-white text-[10px] font-black px-2 py-0.5 rounded transition-colors shadow-sm whitespace-nowrap">開白 ↗</a>
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

          {job.memo && (
            <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
              <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-amber-500 pl-2">特記事項 / 注意事項メモ</h2>
              <div className="bg-amber-50/40 border border-amber-200 rounded p-3 text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                {job.memo}
              </div>
            </div>
          )}

          {/* ワーカーから提出されたリアルタイム報告コメント表示ボード */}
          {job.status !== "open" && job.status !== "draft" && (
            <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
              <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#0082C8] pl-2">
                📥 ワーカーからの報告コメント・作業メモ
              </h2>
              {job.workerComment && job.workerComment.trim() !== "" ? (
                <div className="bg-blue-50/30 border border-blue-200 rounded p-3 text-xs text-slate-800 font-bold whitespace-pre-wrap leading-relaxed shadow-xs">
                  {job.workerComment}
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-400 font-medium italic">
                  ワーカーからのテキスト報告（一時保存・完了メモ）は現在ありません。
                </div>
              )}
            </div>
          )}
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
                {job.status === "draft" && (
                  <button 
                    type="button"
                    onClick={() => triggerModal("publish")}
                    disabled={submitting}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 border border-black/10 text-white text-xs font-black rounded transition-colors text-center shadow-sm"
                  >
                    🟢 案件を本番公開する
                  </button>
                )}

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

                {/* 💡【仕様変更】検収待ち（review）の時、承認ボタンに加えて「差し戻し」ボタンを表示 */}
                {job.status === "review" && (
                  <div className="space-y-2 bg-slate-50 p-2.5 border border-slate-300 rounded">
                    <button 
                      type="button"
                      onClick={() => triggerModal("approve")}
                      disabled={submitting}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded border border-black/10 shadow-md transition-colors"
                    >
                      ✓ 稼働時間を承認して検収完了にする
                    </button>
                    
                    <button 
                      type="button"
                      onClick={() => triggerModal("reject")}
                      disabled={submitting}
                      className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded border border-black/10 shadow-sm transition-colors"
                    >
                      ↩ 案件をワーカーに差し戻す
                    </button>
                  </div>
                )}

                <button 
                  type="button"
                  onClick={() => handleDuplicateJob(false)}
                  className="w-full py-2.5 bg-[#0082C8] hover:bg-[#0072B5] border border-black/10 text-white text-xs font-black rounded transition-all shadow-sm text-center active:scale-95"
                >
                  📄 この案件をコピーして新規作成
                </button>

                <button 
                  type="button"
                  onClick={() => handleDuplicateJob(true)}
                  className="w-full py-2 bg-white hover:bg-slate-50 border-2 border-slate-300 text-slate-700 text-xs font-black rounded transition-colors text-center"
                >
                  ✏️ この案件を編集する
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* シンプルモダンデザインモーダル */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            <div className={`text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none ${
              modalType === "reject" ? "bg-amber-500" : "bg-[#0082C8]"
            }`}>
              <span>
                {modalType === "publish" ? "🟢 案件の公開確認" : 
                 modalType === "draft" ? "🔒 募集停止の確認" : 
                 modalType === "reject" ? "↩ 案件の差し戻し確認" : "✓ 案件の検収承認確認"}
              </span>
            </div>

            <div className="p-6 bg-white space-y-3">
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                {modalType === "publish"
                  ? "この下書き案件を全体に公開し、ワーカーが即座に応募・閲覧できる状態にしますか？"
                  : modalType === "draft"
                  ? "この案件の受諾募集を一度ストップし、非公開の『下書き状態』に戻しますか？\n\n戻すと、ワーカー側の案件を探す画面から一時的に表示が消えます。"
                  : modalType === "reject"
                  ? "提出された報告を差し戻し、ワーカーのステータスを『受諾済み（作業準備中）』に戻しますか？\n\n戻すことで、ワーカーがもう一度タイマーを起動して業務の再開と再提出を行えるようになります。"
                  : "この案件の作業内容および稼働時間を承認（検収完了）しますか？\n\n確定するとステータスが『完了』となり、ワーカー実績として確定します。"
                }
              </p>

              {/* 💡【仕様変更】詳細画面から公開（publish）する時も、通知のオンオフチェックボックスを表示 */}
              {modalType === "publish" && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-[#0082C8] focus:ring-[#0082C8]"
                      checked={shouldNotify}
                      onChange={e => setShouldNotify(e.target.checked)}
                    />
                    <span className="text-[11px] font-black text-slate-700">
                      💬 MEMBERSチャットへ公開通知を送る
                    </span>
                  </label>
                </div>
              )}
            </div>

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
                  modalType === "draft" ? "bg-slate-700 hover:bg-slate-800" : 
                  modalType === "reject" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                はい、実行する
              </button>
            </div>

          </div>
        </div>
      )}

    </OwnerShell>
  );
}