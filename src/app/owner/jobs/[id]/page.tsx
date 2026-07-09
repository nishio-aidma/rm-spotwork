"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
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

  // 💡【新設】ワーカーのID（文字列）から実際の「名前」を表示するための辞書（マップ）
  const [workerNames, setWorkerNames] = useState<{ [key: string]: string }>({});

  // シンプルモダン確認ポップアップ用の管理ステート
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"draft" | "approve" | "publish" | "reject" | null>(null);

  // コピー完了通知用のポップステート
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 詳細画面側の公開モーダル用通知切り替えチェックボックス（デフォルトON）
  const [shouldNotify, setShouldNotify] = useState(true);

  useEffect(() => {
    async function fetchJob() {
      if (!id || !user) return;
      try {
        const docRef = doc(db, "jobs", id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          
          // 💡【既存データ互換処理】ワーカー側と同様に、古い1人用データを仮想的に複数人用（workersマップ）へ変換
          let processedJob = { id: snap.id, ...data } as any;
          if (data.workerId && !data.workers) {
            processedJob.workers = {
              [data.workerId]: {
                status: data.status || "assigned",
                totalAccumulatedSeconds: data.totalAccumulatedSeconds || 0,
                workerComment: data.workerComment || ""
              }
            };
          }
          setJob(processedJob);

          // 💡【複数人対応】受託している全ワーカーの「名前」をデータベースから一括取得する処理
          if (processedJob.workers) {
            const uids = Object.keys(processedJob.workers);
            if (uids.length > 0) {
              const namesMap: { [key: string]: string } = {};
              await Promise.all(uids.map(async (uid) => {
                const uSnap = await getDoc(doc(db, "users", uid));
                if (uSnap.exists()) {
                  const uData = uSnap.data();
                  namesMap[uid] = `${uData.lastName || ""} ${uData.firstName || uData.name || "不明"}`.trim();
                } else {
                  namesMap[uid] = "退会済みユーザー";
                }
              }));
              setWorkerNames(namesMap);
            }
          }
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
      console.warn("MEMBERSの通知設定が見つからないため、通知をスキップしました。");
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
      setShouldNotify(true);
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
        // 💡【一括承認】案件全体を完了にしつつ、参加している各ワーカーの個別ステータスも一斉にcompletedにする
        const updates: any = {
          status: "completed",
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (job.workers) {
          Object.keys(job.workers).forEach(uid => {
            updates[`workers.${uid}.status`] = "completed";
          });
        }
        await updateDoc(jobRef, updates);
        
        setJob((prev: any) => {
          const newJob = { ...prev, status: "completed" };
          if (newJob.workers) {
            Object.keys(newJob.workers).forEach(uid => {
              newJob.workers[uid].status = "completed";
            });
          }
          return newJob;
        });
      }

      else if (action === "publish") {
        await updateDoc(jobRef, {
          status: "open",
          updatedAt: serverTimestamp()
        });
        
        const updatedJob = { ...job, status: "open" };
        setJob(updatedJob);

        if (shouldNotify) {
          await sendMembersNotification(updatedJob);
        }
      }

      else if (action === "reject") {
        // 💡【一括差し戻し】案件全体を差し戻しつつ、各ワーカーの個別ステータスも一斉にassigned（準備中）に戻す
        const updates: any = {
          status: "assigned",
          updatedAt: serverTimestamp()
        };
        if (job.workers) {
          Object.keys(job.workers).forEach(uid => {
            updates[`workers.${uid}.status`] = "assigned";
          });
        }
        await updateDoc(jobRef, updates);

        setJob((prev: any) => {
          const newJob = { ...prev, status: "assigned" };
          if (newJob.workers) {
            Object.keys(newJob.workers).forEach(uid => {
              newJob.workers[uid].status = "assigned";
            });
          }
          return newJob;
        });
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
        additionalLinkTitle: job.additionalLinkTitle || "",
        additionalLinkUrl: job.additionalLinkUrl || "", 
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

  // 💡【合計計算】参加しているワーカー全員の総稼働時間を計算
  const totalAllWorkersSeconds = job.workers 
    ? Object.values(job.workers).reduce((acc: number, w: any) => acc + (w.totalAccumulatedSeconds || 0), 0)
    : (job.totalAccumulatedSeconds || 0);

  const currentWorkerCount = job.workers ? Object.keys(job.workers).length : 0;
  const workerLimit = job.workerLimit || 1;

  return (
    <OwnerShell title="案件詳細・管理デスク" subTitle="発注内容の確認とワーカー稼働の監視">
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
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">関連リンク</span>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-[#5CA685] font-black">下にパッケージ集約 📦</span>
              </div>
            </div>
            
            <div className="p-3 flex flex-col justify-between min-h-[64px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">予定作業件数</span>
              <p className="text-xs font-black text-slate-900 font-mono text-right mt-1">{job.count || 0} 件</p>
            </div>
          </div>

          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-3 shadow-sm">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#5CA685] pl-2">
              🔗 作業詳細（各種リンク設定）
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
              {job.jobType === "form_posting" ? (
                <>
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold">
                    <span className="text-slate-600">📄 送信文面内容</span>
                    {job.formContent ? (
                      <a href={job.formContent} target="_blank" rel="noopener noreferrer" className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">
                        リンクを開く ↗
                      </a>
                    ) : <span className="text-slate-300 font-normal">未登録</span>}
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold">
                    <span className="text-slate-600">📋 入力情報リスト</span>
                    {job.inputInfo ? (
                      <a href={job.inputInfo} target="_blank" rel="noopener noreferrer" className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">
                        リンクを開く ↗
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
                        リンクを開く ↗
                      </a>
                    ) : <span className="text-slate-300 font-normal">未登録</span>}
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded text-xs font-bold">
                    <span className="text-slate-600">📋 入力項目（指示書等）</span>
                    {job.targetItems ? (
                      <a href={job.targetItems} target="_blank" rel="noopener noreferrer" className="bg-[#5CA685] hover:bg-[#4A9272] text-white text-[10px] font-black px-3 py-1 rounded transition-colors shadow-sm">
                        リンクを開く ↗
                      </a>
                    ) : <span className="text-slate-300 font-normal">未登録</span>}
                  </div>
                </>
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

          {/* 💡【新設】参加ワーカーごとの個別カルテ（進捗・稼働時間・メモ）一覧表示ボード */}
          {job.status !== "open" && job.status !== "draft" && (
            <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-3 shadow-sm">
              <div className="flex justify-between items-center border-l-2 border-[#5CA685] pl-2">
                <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  👥 参加ワーカーの稼働状況と報告メモ（{currentWorkerCount}名）
                </h2>
              </div>
              
              <div className="space-y-3">
                {job.workers && Object.keys(job.workers).length > 0 ? (
                  Object.keys(job.workers).map(uid => {
                    const wData = job.workers[uid];
                    return (
                      <div key={uid} className="border border-slate-200 rounded overflow-hidden">
                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-800">{workerNames[uid] || "読み込み中..."}</span>
                            <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
                              wData.status === 'working' ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse' :
                              wData.status === 'review' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                              wData.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              'bg-slate-200 text-slate-600 border border-slate-300'
                            }`}>
                              {wData.status === 'working' ? '稼働中' : 
                               wData.status === 'paused' ? '一時停止' : 
                               wData.status === 'review' ? '完了報告済' : 
                               wData.status === 'completed' ? '検収完了' : '準備中'}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-black text-[#5CA685] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                            ⏱️ {formatTime(wData.totalAccumulatedSeconds || 0)}
                          </span>
                        </div>
                        <div className="p-3 bg-white">
                          {wData.workerComment ? (
                            <div className="text-xs text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
                              {wData.workerComment}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">メモの記録はまだありません</div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded p-4 text-center text-xs text-slate-400 font-medium italic">
                    ワーカーの情報が見つかりません。
                  </div>
                )}
              </div>
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
              
              <div className="bg-slate-100 border border-slate-300 p-2.5 rounded text-[11px] font-bold text-slate-600 flex justify-between items-center select-none">
                <span>👥 現在の受託枠:</span>
                <span className="font-mono text-xs font-black text-[#5CA685]">
                  {currentWorkerCount} / {workerLimit} 名
                </span>
              </div>

              <div className="bg-slate-50 border-2 border-slate-200 p-3 rounded text-center">
                <div className="text-xs font-black text-slate-800">
                  {job.status === 'open' ? '🔓 募集中（ワーカー未定）' : 
                   job.status === 'draft' ? '📋 下書き保存中（非公開）' : 
                   job.status === 'assigned' ? '📥 受諾済み（作業準備中）' : 
                   job.status === 'working' ? '🔴 ワーカー作業中（タイマー稼働）' : 
                   job.status === 'paused' ? '⏸️ 一時中断中' : 
                   job.status === 'review' ? '⌛ 検収待ち（全員報告済）' : 
                   job.status === 'completed' ? '🏁 検収完了（取引終了）' : job.status}
                </div>
              </div>

              {/* 💡 参加者全員の合計時間を計算して表示 */}
              <div className="p-3.5 bg-emerald-50/40 border border-emerald-200 text-slate-900 rounded font-sans shadow-inner space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">TOTAL TIME / 全員の合計稼働実績</span>
                <p className="text-xl font-black text-[#5CA685] tracking-tight font-mono tabular-nums">
                  {formatTime(totalAllWorkersSeconds)}
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
                      ↩ 案件を全員に差し戻す
                    </button>
                  </div>
                )}

                <button 
                  type="button"
                  onClick={() => handleDuplicateJob(false)}
                  className="w-full py-2.5 bg-[#5CA685] hover:bg-[#4A9272] border border-black/10 text-white text-xs font-black rounded transition-all shadow-sm text-center active:scale-95"
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
              modalType === "reject" ? "bg-amber-500" : "bg-[#5CA685]"
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
                  ? "提出された報告を差し戻し、参加ワーカー全員のステータスを『準備中』に戻しますか？\n\n戻すことで、ワーカーがもう一度タイマーを起動して業務の再開と再提出を行えるようになります。"
                  : "この案件の作業内容および参加ワーカー全員の稼働時間を承認（検収完了）しますか？\n\n確定するとステータスが『完了』となり、ワーカー実績として確定します。"
                }
              </p>

              {modalType === "publish" && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-[#5CA685] focus:ring-[#5CA685]"
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
                  modalType === "reject" ? "bg-amber-500 hover:bg-amber-600" : "bg-[#5CA685] hover:bg-[#4A9272]"
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