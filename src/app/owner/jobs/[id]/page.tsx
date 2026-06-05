"use client";

import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import OwnerShell from "@/components/OwnerShell";
import { useRouter } from "next/navigation";

interface OwnerJobDetailPageProps {
  params: Promise<{ id: string }>;
}

const isValidUrl = (url: string) => {
  try {
    return url && (url.startsWith("http://") || url.startsWith("https://"));
  } catch {
    return false;
  }
};

const formatTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
};

export default function OwnerJobDetailPage({ params }: OwnerJobDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // 保存・検収完了・複製作成の二重連打防止用

  // オーナー用カスタムポップアップ管理用のステート群
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalActionType, setModalActionType] = useState<"withdraw" | "duplicate" | "approve" | null>(null);

  // 編集用のローカルステート
  const [editData, setEditData] = useState<any>({});

  useEffect(() => {
    async function fetchJob() {
      try {
        const snap = await getDoc(doc(db, "jobs", id));
        if (snap.exists()) {
          const data = snap.data();
          setJob(data);
          setEditData(data);
        }
      } catch (e) {
        console.error(e);
      } finally { // 💡修正ポイント：private_finally を正しい finally に修正しました
        setLoading(false);
      }
    }
    fetchJob();
  }, [id]);

  // 変更保存処理（修正モード時）
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "jobs", id), {
        ...editData,
        updatedAt: serverTimestamp()
      });
      setJob(editData);
      setIsEditing(false);
      alert("案件情報を更新しました");
    } catch (e) {
      alert("更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // オーナー用ポップアップをトリガーする窓口
  const triggerOwnerModal = (type: "withdraw" | "duplicate" | "approve") => {
    setModalActionType(type);
    if (type === "withdraw") {
      setModalTitle("📥 募集取り下げの確認");
      setModalMessage("この案件を取り下げて下書きに戻しますか？\n実行するとワーカー側の案件一覧リストから即座に非表示になります。");
    } else if (type === "duplicate") {
      setModalTitle("📑 案件コピーの作成");
      setModalMessage("この案件の設定（手順・URL・クライアント等）を完全に引き継いだ、新しい「下書き案件」を複製しますか？");
    } else if (type === "approve") {
      setModalTitle("🏁 検収完了（承認確定）");
      setModalMessage("ワーカーから届いた報告を承認し、検収を完了しますか？\n実行するとステータスが「完了」となり、この案件の作業枠が正常に締め切られます。");
    }
    setModalOpen(true);
  };

  // ポップアップ内の「はい、実行する」を押したときの確定ターミナル
  const handleModalConfirm = async () => {
    setModalOpen(false);
    if (!modalActionType || !job) return;

    setSaving(true);
    try {
      if (modalActionType === "withdraw") {
        await updateDoc(doc(db, "jobs", id), { 
          status: 'draft',
          updatedAt: serverTimestamp()
        });
        alert("案件を取り下げました（下書きに戻しました）");
        router.push("/owner/jobs");
      } 
      else if (modalActionType === "duplicate") {
        const duplicatedData = {
          title: `${job.title}（コピー）`,
          jobType: job.jobType || "form_posting",
          scClient: job.scClient || "",
          count: job.count || 0,
          workerLimit: job.workerLimit || 1,
          deadline: job.deadline || "",
          urgency: job.urgency || "1",
          siteUrl: job.siteUrl || "",
          targetItems: job.targetItems || "",
          formContent: job.formContent || "",
          inputInfo: job.inputInfo || "",
          procedures: job.procedures || [],
          memo: job.memo || "",
          reward: job.reward || 0,
          ownerId: job.ownerId || "",
          status: "draft",
          totalAccumulatedSeconds: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "jobs"), duplicatedData);
        alert("案件の複製が完了しました。新しく生成された「下書きページ」へジャンプします。");
        router.push(`/owner/jobs/${docRef.id}`);
      } 
      else if (modalActionType === "approve") {
        await updateDoc(doc(db, "jobs", id), {
          status: 'completed',
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        alert("検収が完了しました。作業を承認しました。");
        router.push("/owner/jobs");
      }
    } catch (e) {
      console.error(e);
      alert("処理に失敗しました。");
    } finally {
      setSaving(false);
      setModalActionType(null);
    }
  };

  if (loading) return <OwnerShell title="読み込み中..."><div className="p-10 text-center text-slate-400 text-xs font-bold">発注データを照合中...</div></OwnerShell>;
  if (!job) return <OwnerShell title="エラー"><div className="p-10 text-center text-rose-600 font-bold text-xs">案件が見つかりませんでした。</div></OwnerShell>;

  return (
    <OwnerShell title="案件詳細・管理" subTitle={isEditing ? "発注情報の修正編集" : "掲載内容および検収の確認"}>
      {/* 画面構造を「左：発注情報（8カラム）」「右：検収・操作パネル（4カラム）」の黄金2分割へ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 max-w-full mx-auto pb-32 text-slate-900 font-sans antialiased">
        
        {/* 【左側メインエリア：8カラム分】 */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* 上部ナビバー：太線セパレート */}
          <div className="flex justify-between items-center bg-white border-2 border-slate-300 p-4 rounded shadow-sm">
            <button type="button" onClick={() => router.push("/owner/jobs")} className="text-[11px] font-black text-[#0082C8] hover:underline flex items-center gap-1">
              ← 案件管理一覧に戻る
            </button>
            <div className="flex gap-2">
              <span className="bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded font-bold text-[10px]">
                {job.jobType === 'form_posting' ? '✉️ フォーム投稿' : '📋 リスト作成'}
              </span>
            </div>
          </div>

          {/* タイトルコンテナ（通常時 / 編集時） */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 shadow-sm">
            {isEditing ? (
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">案件タイトル（編集）</label>
                <input 
                  className="w-full p-2 bg-slate-50 border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8]"
                  value={editData.title}
                  onChange={e => setEditData({...editData, title: e.target.value})}
                />
              </div>
            ) : (
              <h1 className="text-base font-black tracking-tight text-slate-950 leading-snug">{job.title}</h1>
            )}
          </div>

          {/* 作業詳細URL設定 */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-4 shadow-sm">
            {job.jobType === 'form_posting' ? (
              <>
                {/* フォーム投稿：送信文面内容 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">送信文面内容（スプレッドシート等URL）</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input type="url" className="flex-1 p-2 bg-slate-50 border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#0082C8]" value={editData.formContent || ""} onChange={e => setEditData({...editData, formContent: e.target.value})} />
                      {isValidUrl(editData.formContent) && <a href={editData.formContent} target="_blank" rel="noopener noreferrer" className="bg-white border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#0082C8] whitespace-nowrap">↗ テスト</a>}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-300 rounded p-2.5">
                      {job.formContent ? (
                        <a href={job.formContent} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded transition-colors shadow-sm">
                          📄 送信文面シートを開く ↗
                        </a>
                      ) : <span className="text-xs text-slate-400 italic">未設定</span>}
                    </div>
                  )}
                </div>

                {/* フォーム投稿：入力情報 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">入力情報（リスト等URL）</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input type="url" className="flex-1 p-2 bg-slate-50 border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#0082C8]" value={editData.inputInfo || ""} onChange={e => setEditData({...editData, inputInfo: e.target.value})} />
                      {isValidUrl(editData.inputInfo) && <a href={editData.inputInfo} target="_blank" rel="noopener noreferrer" className="bg-white border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#0082C8] whitespace-nowrap">↗ テスト</a>}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-300 rounded p-2.5">
                      {job.inputInfo ? (
                        <a href={job.inputInfo} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded transition-colors shadow-sm">
                          📂 入力情報リストを開く ↗
                        </a>
                      ) : <span className="text-xs text-slate-400 italic">未設定</span>}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* リスト作成：抽出サイトURL */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">抽出サイトURL</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input type="url" className="flex-1 p-2 bg-slate-50 border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#0082C8]" value={editData.siteUrl || ""} onChange={e => setEditData({...editData, siteUrl: e.target.value})} />
                      {isValidUrl(editData.siteUrl) && <a href={editData.siteUrl} target="_blank" rel="noopener noreferrer" className="bg-white border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#0082C8] whitespace-nowrap">↗ テスト</a>}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-300 rounded p-2.5">
                      {job.siteUrl ? (
                        <a href={job.siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded transition-colors shadow-sm break-all">
                          🌐 抽出対象サイトを開く ↗
                        </a>
                      ) : <span className="text-xs text-slate-400 italic">未設定</span>}
                    </div>
                  )}
                </div>

                {/* リスト作成：入力項目 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">入力項目（指示書等URL）</label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <input type="url" className="flex-1 p-2 bg-slate-50 border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#0082C8]" value={editData.targetItems || ""} onChange={e => setEditData({...editData, targetItems: e.target.value})} />
                      {isValidUrl(editData.targetItems) && <a href={editData.targetItems} target="_blank" rel="noopener noreferrer" className="bg-white border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#0082C8] whitespace-nowrap">↗ テスト</a>}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-300 rounded p-2.5">
                      {job.targetItems ? (
                        <a href={job.targetItems} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-[#0082C8] hover:bg-[#0072B5] text-white text-xs font-black px-4 py-2 rounded transition-colors shadow-sm">
                          📂 入力項目指示書を開く ↗
                        </a>
                      ) : <span className="text-xs text-slate-400 italic">未設定</span>}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* スペックグリッド */}
          <div className="grid grid-cols-2 md:grid-cols-4 bg-white border-2 border-slate-300 rounded overflow-hidden divide-x-2 divide-y-2 md:divide-y-0 divide-slate-300 shadow-sm">
            <div className="p-3 space-y-0.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">SCクライアント</span>
              {isEditing ? (
                <input className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-bold" value={editData.scClient || ""} onChange={e => setEditData({...editData, scClient: e.target.value})} />
              ) : (
                <p className="text-xs font-bold text-slate-800 truncate">{job.scClient || "-"}</p>
              )}
            </div>
            <div className="p-3 space-y-0.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">期日</span>
              {isEditing ? (
                <input type="date" className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-mono font-bold" value={editData.deadline || ""} onChange={e => setEditData({...editData, deadline: e.target.value})} />
              ) : (
                <p className="text-xs font-bold text-slate-800 font-mono">{job.deadline || "未設定"}</p>
              )}
            </div>
            <div className="p-3 space-y-0.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">募集人数 / 予定数</span>
              {isEditing ? (
                <div className="flex gap-1">
                  <input type="number" className="w-1/2 bg-slate-50 border border-slate-300 rounded p-1 text-xs font-bold" value={editData.workerLimit || 1} onChange={e => setEditData({...editData, workerLimit: Number(e.target.value)})} />
                  <input type="number" className="w-1/2 bg-slate-50 border border-slate-300 rounded p-1 text-xs font-bold" value={editData.count || 0} onChange={e => setEditData({...editData, count: Number(e.target.value)})} />
                </div>
              ) : (
                <p className="text-xs font-black text-slate-900">
                  {job.workerLimit || 1}名 / <span className="font-mono">{job.count || 0}件</span>
                </p>
              )}
            </div>
            <div className="p-3 space-y-0.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">優先度</span>
              {isEditing ? (
                <select className="w-full bg-slate-50 border border-slate-300 rounded p-1 text-xs font-bold" value={editData.urgency || "1"} onChange={e => setEditData({...editData, urgency: e.target.value})}>
                  <option value="1">通常</option>
                  <option value="2">高め</option>
                  <option value="3">至急</option>
                </select>
              ) : (
                <p className="text-xs font-bold text-slate-800">
                  {job.urgency === "3" ? "🔴 至急" : job.urgency === "2" ? "🟡 高め" : "通常"}
                </p>
              )}
            </div>
          </div>

          {/* 作業手順明細 */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-emerald-600 pl-2">作業手順明細</h2>
            <div className="divide-y-2 divide-slate-200 border-2 border-slate-200 rounded overflow-hidden bg-slate-50">
              {(isEditing ? editData.procedures || ["", "", ""] : job.procedures || []).map((step: string, i: number) => (
                <div key={i} className="flex gap-3 items-center p-2.5 bg-white text-xs">
                  <span className="text-[11px] bg-slate-100 border border-slate-300 text-slate-500 px-1.5 py-0.5 font-mono font-bold rounded">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {isEditing ? (
                    <input 
                      className="flex-1 p-1 bg-slate-50 border border-slate-300 rounded text-xs font-medium outline-none" 
                      value={step}
                      onChange={e => {
                        const newPro = [...editData.procedures];
                        newPro[i] = e.target.value;
                        setEditData({...editData, procedures: newPro});
                      }}
                    />
                  ) : (
                    <p className="text-xs font-bold text-slate-800 flex-1">{step || "未設定"}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 特記事項 / メモ欄 */}
          <div className="bg-white border-2 border-slate-300 rounded p-4 space-y-2 shadow-sm">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-amber-500 pl-2">特記事項 / メモ欄</h2>
            {isEditing ? (
              <textarea 
                rows={3}
                className="w-full p-2 bg-slate-50 border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#0082C8]"
                placeholder="特記事項や社内メモを入力してください"
                value={editData.memo || ""}
                onChange={e => setEditData({...editData, memo: e.target.value})}
              />
            ) : (
              <div className="bg-amber-50/20 border border-amber-200 rounded p-3 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap font-medium">
                {job.memo || "特記事項はありません。"}
              </div>
            )}
          </div>

        </div>

        {/* 【右側エリア：4カラム分】お会計・検収コントロールコンソール */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 h-fit">
          <div className="bg-white border-2 border-slate-300 rounded shadow-sm overflow-hidden">
            
            <div className="bg-slate-100 p-3 border-b-2 border-slate-300 flex justify-between items-center">
              <span className="text-xs font-black text-slate-700">発注・検収ステータス</span>
              <span className="text-[10px] font-mono font-bold text-slate-400">CONSOLE</span>
            </div>

            <div className="p-4 space-y-4">
              
              {/* ステータスバッジの大きな表示セル */}
              <div className="bg-slate-50 border-2 border-slate-200 p-3 rounded text-center">
                <div className={`text-sm font-black ${job.status === 'review' ? 'text-amber-600 animate-pulse' : 'text-slate-800'}`}>
                  {job.status === 'draft' ? '📁 一時下書き保存中' : 
                   job.status === 'open' ? '🔓 募集中（作業者未定）' : 
                   job.status === 'assigned' ? '📥 請負中（準備期間中）' : 
                   job.status === 'working' ? '🔴 ワーカー実稼働計測中' : 
                   job.status === 'paused' ? '⏸️ 作業一時停止中' : 
                   job.status === 'review' ? '⌛ ⭐ 検収依頼が届いています' : 
                   job.status === 'completed' ? '🏁 業務完了（検収承認済み）' : job.status}
                </div>
              </div>

              {/* タイムカード実績確認コンソール */}
              {(job.status !== 'open' && job.status !== 'draft') && (
                <div className="p-4 bg-slate-950 text-white rounded font-mono shadow-inner space-y-3">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">ASSIGNED WORKER / 担当者ID</span>
                    <p className="text-xs font-bold text-slate-200 truncate">{job.workerId || "未割当"}</p>
                  </div>
                  <div className="border-t border-slate-800 pt-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">ACCUMULATED TIME / 累積稼働</span>
                    <p className="text-xl font-black text-emerald-400 tracking-tight tabular-nums">{formatTime(job.totalAccumulatedSeconds || 0)}</p>
                  </div>
                </div>
              )}

              {/* アクションボタン */}
              <div className="space-y-2 pt-2">
                {isEditing ? (
                  <>
                    <button 
                      type="button"
                      onClick={handleSave} 
                      disabled={saving} 
                      className="w-full py-3 bg-slate-900 text-white text-xs font-black rounded border border-black/10 hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
                    >
                      {saving ? "データ保存中..." : "💾 修正内容を確定・保存"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setIsEditing(false); setEditData(job); }} 
                      className="w-full py-2 bg-white border-2 border-slate-300 text-slate-600 text-xs font-black rounded hover:bg-slate-50 transition-colors"
                    >
                      編集をキャンセル
                    </button>
                  </>
                ) : (
                  <>
                    {job.status === 'review' && (
                      <button 
                        type="button"
                        onClick={() => triggerOwnerModal("approve")} 
                        disabled={saving}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded border border-black/10 transition-colors shadow-md disabled:opacity-50"
                      >
                        🏁 検収を完了する（承認）
                      </button>
                    )}

                    {job.status === 'open' && (
                      <button 
                        type="button"
                        onClick={() => triggerOwnerModal("withdraw")} 
                        disabled={saving}
                        className="w-full py-2.5 bg-white border-2 border-rose-300 hover:bg-rose-50 text-rose-600 text-xs font-black rounded transition-colors"
                      >
                        📥 募集を取り下げて下書きに戻す
                      </button>
                    )}

                    <button 
                      type="button"
                      onClick={() => triggerOwnerModal("duplicate")}
                      disabled={saving}
                      className="w-full py-2.5 bg-slate-100 border-2 border-slate-400 hover:bg-slate-200 text-slate-800 text-xs font-black rounded transition-colors shadow-sm disabled:opacity-50"
                    >
                      📑 この案件をコピーして複製
                    </button>

                    <button 
                      type="button"
                      onClick={() => setIsEditing(true)} 
                      className="w-full py-2.5 bg-white border-2 border-slate-400 hover:bg-slate-50 text-slate-800 text-xs font-black rounded transition-colors shadow-sm"
                    >
                      🛠️ この掲載内容を修正する
                    </button>
                  </>
                )}
              </div>

            </div>
          </div>
          
          <p className="text-[10px] text-slate-400 leading-relaxed p-2 font-medium">
            ※ワーカーから完了報告が届くとステータスが「検収待ち」になります。内容と累積時間を確認のうえ、承認を行ってください。
          </p>
        </div>

      </div>

      {/* =========================================================================
          💡【修正配備】オーナー用 POSレジ風ソリッドデザイン・カスタム確認ポップアップ（モーダル）
          ========================================================================= */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 font-sans antialiased">
          <div className="bg-white border-4 border-slate-950 w-full max-w-sm rounded shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] overflow-hidden text-slate-900">
            
            {/* ポップアップヘッダー */}
            <div className="bg-slate-950 text-white p-3 font-black text-xs flex justify-between items-center tracking-wider select-none">
              <span>{modalTitle}</span>
              <span className="text-[9px] font-mono font-bold text-slate-400">OWNER CONSOLE</span>
            </div>

            {/* ポップアップ本文 */}
            <div className="p-5 border-b-2 border-slate-200 bg-slate-50">
              <p className="text-xs font-bold text-slate-700 leading-relaxed whitespace-pre-wrap">
                {modalMessage}
              </p>
            </div>

            {/* アクションボタン */}
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

    </OwnerShell> // 💡修正ポイント：末尾の噛み合わせバグを完全に直しました
  );
}