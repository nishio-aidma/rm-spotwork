"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import OwnerShell from "@/components/OwnerShell";

// 簡単なURLバリデーション関数（ボタンの表示・非表示用）
const isValidUrl = (url: string) => {
  try {
    return url.startsWith("http://") || url.startsWith("https://");
  } catch {
    return false;
  }
};

function JobForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [jobType, setJobType] = useState<'form_posting' | 'list_creation'>('form_posting');
  
  const [formData, setFormData] = useState({
    title: "",
    reward: 0,       // ① 報酬はフォームから撤去し、裏で0固定で送信
    count: 100,      // 予定作業件数
    workerLimit: 1,  // 募集人数
    deadline: "",
    urgency: "1",
    siteUrl: "",
    targetItems: "", // ⑤ リスト作成 > 「入力項目」URL用
    formContent: "", // ② フォーム投稿 > 「送信文面内容」URL用
    inputInfo: "",   // ④ フォーム投稿 > 「入力情報」URL用
    scClient: "",    // SCクライアント
    procedures: ["", "", ""],
    memo: ""         // ⑥ 新規追加：メモ欄
  });

  // カスタムポップアップ管理用のステート群
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalTargetStatus, setModalTargetStatus] = useState<'open' | 'draft' | null>(null);

  // 💡【新設・完全復活】複製データの自動パース＆引き継ぎ展開ロジック
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("duplicate_job_base");
      if (stored) {
        const baseData = JSON.parse(stored);
        
        // 元の仕事種別（jobType）を同期
        if (baseData.jobType) setJobType(baseData.jobType);

        // 各種オブジェクトデータをformDataステートに一括マッピング
        setFormData(prev => ({
          ...prev,
          title: baseData.title || "",
          count: baseData.count || 100,
          workerLimit: baseData.workerLimit || 1,
          urgency: baseData.urgency || "1",
          deadline: baseData.deadline || "",
          scClient: baseData.scClient || "",
          siteUrl: baseData.siteUrl || "",
          targetItems: baseData.targetItems || "",
          formContent: baseData.formContent || "",
          inputInfo: baseData.inputInfo || "",
          procedures: Array.isArray(baseData.procedures) ? baseData.procedures : ["", "", ""],
          memo: baseData.memo || ""
        }));

        // 使い終わったストレージのゴミ箱は綺麗に空にしておく（通常作成時と混ざらない安全ガード）
        sessionStorage.removeItem("duplicate_job_base");
      }
    } catch (e) {
      console.error("複製データの展開に失敗しました:", e);
    }
  }, []);

  // ボタンを押したときにまずポップアップを開く仕掛け
  const triggerSubmitModal = (status: 'open' | 'draft') => {
    if (!formData.title.trim()) {
      const fakeSubmitButton = document.getElementById("hidden-submit-trigger");
      if (fakeSubmitButton) fakeSubmitButton.click();
      return;
    }

    setModalTargetStatus(status);
    if (status === 'open') {
      setModalTitle("🔓 案件公開の確認");
      setModalMessage(`以下の内容で案件を即座に「公開」しますか？\n\nタイトル：${formData.title}\n\n※公開するとワーカー全員の仕事探し一覧に即時掲載され、受諾募集がスタートします。`);
    } else {
      setModalTitle("📁 下書き保存の確認");
      setModalMessage(`以下の内容を「下書き」として一時保存しますか？\n\nタイトル：${formData.title || "（タイトル未入力）"}\n\n※下書き状態の間はワーカーには一切表示されません。`);
    }
    setModalOpen(true);
  };

  // ポップアップ内で「はい」を押したときに、本番のFirebase送信を走らせる
  const handleModalConfirm = async () => {
    if (!auth.currentUser || !modalTargetStatus) return;
    setModalOpen(false);
    setSubmitting(true);

    try {
      await addDoc(collection(db, "jobs"), {
        ...formData,
        jobType,
        ownerId: auth.currentUser.uid,
        status: modalTargetStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        totalAccumulatedSeconds: 0
      });
      router.push("/owner/jobs");
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました");
    } finally {
      setSubmitting(false);
      setModalTargetStatus(null);
    }
  };

  const handleProcedureChange = (index: number, value: string) => {
    const newProcedures = [...formData.procedures];
    newProcedures[index] = value;
    setFormData({ ...formData, procedures: newProcedures });
  };

  return (
    <div className="max-w-full mx-auto pb-20 text-slate-900 font-sans antialiased">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        
        {/* =========================================================================
            💡【仕様完全保持】仕事種別（トグル）と自動連動する事前準備ガイドメッセージセクション
            ========================================================================= */}
        <section className="bg-slate-50 border-2 border-dashed border-slate-300 rounded p-3.5 space-y-2 shadow-inner">
          <div className="flex items-start gap-2">
            <span className="text-xs">💡</span>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800">
                {jobType === 'form_posting' ? '✉️ フォーム投稿案件の事前準備' : '📋 リスト作成案件の事前準備'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                案件の新規作成にあたって、まずは事前準備のシート作成をしてください。<br />
                下記の原本シートを開いてコピーを作成し、指定の共有Googleドライブフォルダへ保存をお願いします。
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-1 pl-6">
            {jobType === 'form_posting' ? (
              <>
                <a 
                  href="https://docs.google.com/spreadsheets/d/1KZRA_rLLIB5015vUxA8qYfcQPdMPbEy_WlYNER3TxEE/edit?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-[10px] font-black px-2.5 py-1 rounded transition-colors shadow-sm inline-flex items-center gap-1"
                >
                  📄 1. フォーム用 原本シートを開く ↗
                </a>
                <a 
                  href="https://drive.google.com/drive/folders/1FJnvSuJN_CQ46LbSjSXfUm9aIB9f_9ux?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-[10px] font-black px-2.5 py-1 rounded transition-colors shadow-sm inline-flex items-center gap-1"
                >
                  📁 2. フォーム用 格納フォルダを開く ↗
                </a>
              </>
            ) : (
              <>
                <a 
                  href="https://docs.google.com/spreadsheets/d/1HfFC_0AvmNUZOByMhYN4aKzl4g_mmPHsxxj2o0pn6pc/edit?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-[10px] font-black px-2.5 py-1 rounded transition-colors shadow-sm inline-flex items-center gap-1"
                >
                  📄 1. リスト用 原本シートを開く ↗
                </a>
                <a 
                  href="https://drive.google.com/drive/folders/1h_QnAfn4dQajxuLjwvQKBVAjCS2-L4pn?usp=sharing" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-[10px] font-black px-2.5 py-1 rounded transition-colors shadow-sm inline-flex items-center gap-1"
                >
                  📁 2. リスト用 格納フォルダを開く ↗
                </a>
              </>
            )}
          </div>
        </section>


        {/* 1. 基本設定セクション */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#0082C8] pl-2">基本設定</h2>
          <div className="bg-white p-4 rounded border-2 border-slate-300 space-y-4 shadow-sm">
            
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => setJobType('form_posting')}
                className={`py-2.5 rounded border-2 text-xs font-black transition-colors ${
                  jobType === 'form_posting' 
                    ? 'bg-[#0082C8] text-white border-transparent' 
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                }`}
              >
                ✉️ フォーム投稿
              </button>
              <button 
                type="button"
                onClick={() => setJobType('list_creation')}
                className={`py-2.5 rounded border-2 text-xs font-black transition-colors ${
                  jobType === 'list_creation' 
                    ? 'bg-[#0082C8] text-white border-transparent' 
                    : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                }`}
              >
                📋 リスト作成
              </button>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">案件タイトル</label>
              <input 
                required
                className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8] transition-colors" 
                placeholder="例：問い合わせフォーム投稿業務（〇〇月度）"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
              <button type="submit" id="hidden-submit-trigger" className="hidden" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">作業件数</label>
                <input type="number" className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8]" value={formData.count} onChange={e => setFormData({...formData, count: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">募集人数</label>
                <input type="number" className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8]" value={formData.workerLimit} onChange={e => setFormData({...formData, workerLimit: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">優先度</label>
                <select className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8]" value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value})}>
                  <option value="1">通常</option>
                  <option value="2">高め</option>
                  <option value="3">至急</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">期日</label>
              <input type="date" className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8]" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
            </div>
          </div>
        </section>

        {/* 2. 作業詳細セクション */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#0082C8] pl-2">作業詳細（リンク設定）</h2>
          <div className="bg-white p-4 rounded border-2 border-slate-300 space-y-4 shadow-sm">
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">SCクライアント</label>
              <input 
                className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8] transition-colors" 
                placeholder="案件に紐づくクライアント名を入力"
                value={formData.scClient}
                onChange={e => setFormData({...formData, scClient: e.target.value})} 
              />
            </div>

            {jobType === 'form_posting' ? (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">送信文面内容（スプレッドシート等のURL）</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      className="flex-1 p-2 bg-white border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#0082C8] font-mono" 
                      placeholder="https://docs.google.com/spreadsheets/..." 
                      value={formData.formContent} 
                      onChange={e => setFormData({...formData, formContent: e.target.value})} 
                    />
                    {isValidUrl(formData.formContent) && (
                      <a href={formData.formContent} target="_blank" rel="noopener noreferrer" className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#0082C8] whitespace-nowrap transition-colors">
                        ↗ リンクを開く
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">入力情報（リスト等のURL）</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      className="flex-1 p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8]" 
                      placeholder="https://..." 
                      value={formData.inputInfo} 
                      onChange={e => setFormData({...formData, inputInfo: e.target.value})} 
                    />
                    {isValidUrl(formData.inputInfo) && (
                      <a href={formData.inputInfo} target="_blank" rel="noopener noreferrer" className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#0082C8] whitespace-nowrap transition-colors">
                        ↗ リンクを開く
                      </a>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">抽出サイトURL</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      className="flex-1 p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8]" 
                      placeholder="https://example.com" 
                      value={formData.siteUrl} 
                      onChange={e => setFormData({...formData, siteUrl: e.target.value})} 
                    />
                    {isValidUrl(formData.siteUrl) && (
                      <a href={formData.siteUrl} target="_blank" rel="noopener noreferrer" className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#0082C8] whitespace-nowrap transition-colors">
                        ↗ リンクを開く
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">入力項目（指示書等のURL）</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      className="flex-1 p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#0082C8]" 
                      placeholder="https://..." 
                      value={formData.targetItems} 
                      onChange={e => setFormData({...formData, targetItems: e.target.value})} 
                    />
                    {isValidUrl(formData.targetItems) && (
                      <a href={formData.targetItems} target="_blank" rel="noopener noreferrer" className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#0082C8] whitespace-nowrap transition-colors">
                        ↗ リンクを開く
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* 3. 作業手順セクション */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-emerald-600 pl-2">具体的な手順 (3ステップ)</h2>
          <div className="divide-y-2 divide-slate-200 border-2 border-slate-200 rounded overflow-hidden bg-slate-50 shadow-sm">
            {formData.procedures.map((p, i) => (
              <div key={i} className="flex gap-3 items-center p-2.5 bg-white text-xs">
                <span className="text-[11px] bg-slate-100 border border-slate-300 text-slate-500 px-1.5 py-0.5 font-mono font-bold rounded">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <input 
                  className="flex-1 p-1.5 bg-white border border-slate-300 rounded text-xs font-medium outline-none focus:border-slate-500" 
                  placeholder={`手順 ${i + 1} を入力`}
                  value={p}
                  onChange={e => handleProcedureChange(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* メモ欄 */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-amber-500 pl-2">メモ欄</h2>
          <div className="bg-white border-2 border-slate-300 rounded p-4 shadow-sm">
            <textarea 
              rows={4} 
              className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#0082C8]" 
              placeholder="社内共有用のメモや、特記事項があれば自由に入力してください（ワーカー側からも閲覧可能です）" 
              value={formData.memo} 
              onChange={e => setFormData({...formData, memo: e.target.value})} 
            />
          </div>
        </section>

        {/* アクションエリア */}
        <div className="pt-4 flex gap-3 justify-end">
          <button 
            type="button" 
            onClick={() => router.back()} 
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 rounded text-xs font-black transition-colors"
          >
            キャンセル
          </button>
          
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => triggerSubmitModal('draft')}
              disabled={submitting}
              className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-800 rounded text-xs font-black hover:bg-slate-50 hover:border-slate-400 transition-colors"
            >
              下書きとして保存
            </button>
            <button 
              type="button"
              onClick={() => triggerSubmitModal('open')}
              disabled={submitting}
              className="px-5 py-2 bg-[#0082C8] hover:bg-[#0072B5] text-white border border-black/10 rounded text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
            >
              {submitting ? "処理中..." : "案件を公開する"}
            </button>
          </div>
        </div>

      </form>

      {/* 💡【超シンプル化刷新】ゴツい黒太枠＆影のPOSレジ風モーダルをバッサリ全撤去！極上シンプルモダンデザインへ統一 */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            
            {/* ポップアップヘッダー */}
            <div className="bg-[#0082C8] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>{modalTitle}</span>
            </div>

            {/* ポップアップ本文 */}
            <div className="p-6 bg-white">
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                {modalMessage}
              </p>
            </div>

            {/* アクションボタン */}
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                className="px-4 py-2 bg-[#0082C8] hover:bg-[#0072B5] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm"
              >
                はい、実行する
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default function NewJobPage() {
  return (
    <OwnerShell title="新規案件の作成" subTitle="案件の掲載設定">
      <Suspense fallback={<div className="p-10 text-center text-slate-400 text-xs font-bold">フォームを表示中...</div>}>
        <JobForm />
      </Suspense>
    </OwnerShell>
  );
}