"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
// 💡【追加】getDocs と deleteDoc をインポートに追加
import { collection, addDoc, doc, updateDoc, getDoc, getDocs, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import OwnerShell from "@/components/OwnerShell";
import { sendMembersNotification } from "@/lib/members";

const isValidUrl = (url: string) => {
  try {
    return url.startsWith("http://") || url.startsWith("https://");
  } catch {
    return false;
  }
};

// 作業詳細の追加項目インターフェース
interface DetailItem {
  title: string;
  type: 'link' | 'text';
  value: string;
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

function JobForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  
  // 💡【変更】型を固定文字列から string へ変更（自由に拡張できるように）
  const [jobType, setJobType] = useState<string>('form_posting');
  
  const [existingJobId, setExistingJobId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    reward: 0,
    count: 100,
    workerLimit: 1,
    deadline: "",
    urgency: "1",
    scClient: "",
    detailItems: [
      { title: "指示書・マニュアル", type: "link", value: "" },
      { title: "作業用リスト", type: "link", value: "" }
    ] as DetailItem[],
    procedures: ["", "", ""],
    memo: ""
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalTargetStatus, setModalTargetStatus] = useState<'open' | 'draft' | null>(null);

  const [noticeMessage, setNoticeMessage] = useState("");
  const [shouldNotify, setShouldNotify] = useState(true);

  // 💡【追加】カスタムお仕事種類管理用のステート群
  const [customJobTypes, setCustomJobTypes] = useState<{id: string, name: string}[]>([]);
  const [jobTypeSettingsOpen, setJobTypeSettingsOpen] = useState(false);
  const [newJobTypeName, setNewJobTypeName] = useState("");
  const [isUpdatingJobType, setIsUpdatingJobType] = useState(false);

  // 💡【追加】Firestoreからカスタムのお仕事種類を取得する処理
  useEffect(() => {
    const fetchCustomJobTypes = async () => {
      try {
        const snap = await getDocs(collection(db, "customJobTypes"));
        const types = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setCustomJobTypes(types);
      } catch (e) {
        console.error("カスタムお仕事種類の取得に失敗しました:", e);
      }
    };
    fetchCustomJobTypes();
  }, []);

  // コピーボタン・編集ボタンからのデータ復元
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("duplicate_job_base");
      if (stored) {
        const baseData = JSON.parse(stored);
        
        if (baseData.jobType) setJobType(baseData.jobType);

        let restoredDetailItems: DetailItem[] = [];
        if (Array.isArray(baseData.detailItems) && baseData.detailItems.length > 0) {
          restoredDetailItems = baseData.detailItems;
        } else {
          // 旧データ構造からの自動変換引き継ぎ
          if (baseData.formContent) restoredDetailItems.push({ title: "送信文面内容", type: "link", value: baseData.formContent });
          if (baseData.inputInfo) restoredDetailItems.push({ title: "入力情報リスト", type: "link", value: baseData.inputInfo });
          if (baseData.siteUrl) restoredDetailItems.push({ title: "抽出サイトURL", type: "link", value: baseData.siteUrl });
          if (baseData.targetItems) restoredDetailItems.push({ title: "入力項目指示書", type: "link", value: baseData.targetItems });
          if (baseData.additionalLinkUrl) restoredDetailItems.push({ title: baseData.additionalLinkTitle || "追加リンク", type: "link", value: baseData.additionalLinkUrl });
          
          if (restoredDetailItems.length === 0) {
            restoredDetailItems = [
              { title: "指示書・マニュアル", type: "link", value: "" },
              { title: "作業用リスト", type: "link", value: "" }
            ];
          }
        }

        setFormData(prev => ({
          ...prev,
          title: baseData.title || "",
          reward: 0,
          count: baseData.count || 100,
          workerLimit: baseData.workerLimit || 1,
          urgency: baseData.urgency || "1",
          deadline: baseData.deadline || "",
          scClient: baseData.scClient || "",
          detailItems: restoredDetailItems,
          procedures: Array.isArray(baseData.procedures) && baseData.procedures.length > 0 
                      ? baseData.procedures 
                      : ["", "", ""],
          memo: baseData.memo || ""
        }));

        if (baseData.existingJobId) {
          setExistingJobId(baseData.existingJobId);
        }

        sessionStorage.removeItem("duplicate_job_base");
      }
    } catch (e) {
      console.error("データの自動展開に失敗しました:", e);
    }
  }, []);

  // 💡【追加】お仕事の種類の追加保存ハンドラー
  const handleAddJobType = async () => {
    if (!newJobTypeName.trim()) return;
    setIsUpdatingJobType(true);
    try {
      const docRef = await addDoc(collection(db, "customJobTypes"), {
        name: newJobTypeName.trim(),
        createdAt: serverTimestamp()
      });
      setCustomJobTypes([...customJobTypes, { id: docRef.id, name: newJobTypeName.trim() }]);
      setNewJobTypeName(""); // 入力欄をクリア
    } catch (e) {
      console.error(e);
      alert("種類の追加に失敗しました。");
    } finally {
      setIsUpdatingJobType(false);
    }
  };

  // 💡【追加】お仕事の種類の削除ハンドラー
  const handleDeleteJobType = async (id: string, name: string) => {
    setIsUpdatingJobType(true);
    try {
      await deleteDoc(doc(db, "customJobTypes", id));
      setCustomJobTypes(customJobTypes.filter(t => t.id !== id));
      
      // もし削除された種類が現在選択中のものだった場合は、デフォルトに戻す
      if (jobType === name) {
        setJobType('form_posting');
      }
    } catch (e) {
      console.error(e);
      alert("種類の削除に失敗しました。");
    } finally {
      setIsUpdatingJobType(false);
    }
  };

  const handleAddDetailItem = () => {
    setFormData({
      ...formData,
      detailItems: [...formData.detailItems, { title: "", type: "link", value: "" }]
    });
  };

  const handleRemoveDetailItem = (index: number) => {
    const newItems = formData.detailItems.filter((_, i) => i !== index);
    setFormData({ ...formData, detailItems: newItems });
  };

  const handleDetailItemChange = (index: number, field: keyof DetailItem, val: string) => {
    const newItems = [...formData.detailItems];
    newItems[index] = { ...newItems[index], [field]: val };
    setFormData({ ...formData, detailItems: newItems });
  };

  const handleProcedureChange = (index: number, value: string) => {
    const newProcedures = [...formData.procedures];
    newProcedures[index] = value;
    setFormData({ ...formData, procedures: newProcedures });
  };

  const handleAddProcedure = () => {
    setFormData({ ...formData, procedures: [...formData.procedures, ""] });
  };

  const handleRemoveProcedure = (index: number) => {
    if (formData.procedures.length <= 1) return;
    const newProcedures = formData.procedures.filter((_, i) => i !== index);
    setFormData({ ...formData, procedures: newProcedures });
  };

  const triggerSubmitModal = (status: 'open' | 'draft') => {
    if (!formData.title.trim()) {
      const fakeSubmitButton = document.getElementById("hidden-submit-trigger");
      if (fakeSubmitButton) fakeSubmitButton.click();
      return;
    }

    setModalTargetStatus(status);
    if (status === 'open') {
      setNoticeMessage("");
      setShouldNotify(true);
    }
    
    if (existingJobId) {
      setModalTitle(status === 'open' ? "🔓 編集内容の公開適用" : "📁 編集内容の下書き保存");
      setModalMessage(`修正した内容を既存の案件に上書き保存しますか？\n\nタイトル：${formData.title}`);
    } else {
      if (status === 'open') {
        setModalTitle("🔓 案件公開の確認");
        setModalMessage(`以下の内容で案件を即座に「公開」しますか？\n\nタイトル：${formData.title}\n\n※公開するとワーカー全員の仕事探し一覧に即時掲載され、受諾募集がスタートします。`);
      } else {
        setModalTitle("📁 下書き保存の確認");
        setModalMessage(`以下の内容を「下書き」として一時保存しますか？\n\nタイトル：${formData.title || "（タイトル未入力）"}\n\n※下書き状態の間はワーカーには一切表示されません。`);
      }
    }
    setModalOpen(true);
  };

  const handleModalConfirm = async () => {
    if (!auth.currentUser || !modalTargetStatus) return;
    setModalOpen(false);
    setSubmitting(true);

    try {
      const sharedFields: any = {
        ...formData,
        jobType,
        ownerId: "system_shared_owner",
        updatedAt: serverTimestamp()
      };

      let finalStatus = modalTargetStatus;
      let isStatusChangedToOpen = modalTargetStatus === 'open';

      if (existingJobId) {
        const jobRef = doc(db, "jobs", existingJobId);
        const jobSnap = await getDoc(jobRef);
        if (jobSnap.exists()) {
          const currentJobData = jobSnap.data();
          const currentStatus = currentJobData.status || "draft";
          const isAlreadyStarted = ["assigned", "working", "paused", "review", "completed"].includes(currentStatus);
          
          if (isAlreadyStarted) {
            finalStatus = currentStatus;
            isStatusChangedToOpen = false;
          } else {
            if (currentStatus === 'open' && modalTargetStatus === 'open') {
              isStatusChangedToOpen = false;
            }
          }
        }

        await updateDoc(jobRef, {
          ...sharedFields,
          status: finalStatus
        });
        router.push(`/owner/jobs/${existingJobId}`);
      } else {
        await addDoc(collection(db, "jobs"), {
          ...sharedFields,
          status: finalStatus,
          createdBy: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          totalAccumulatedSeconds: 0
        });
        router.push("/owner/jobs");
      }

      if (finalStatus === 'open' && isStatusChangedToOpen && shouldNotify) {
        // 💡【修正】カスタム種類の場合もそのまま通知ラベルに適用
        const typeLabel = jobType === 'form_posting' ? "✉️ フォーム投稿" 
                        : jobType === 'list_creation' ? "📋 リスト作成" 
                        : jobType;

        const chatTemplate = `🔥🔥🔥spotworkに新しい案件が追記されました🔥🔥🔥

✏️追加された案件：${formData.title}

🏢クライアント：${formData.scClient || "（未入力）"}

📚仕事の種類：${typeLabel}

🔢件数：${formData.count} 件

✅期日：${formData.deadline || "（未設定）"}

💭申し送り内容：
${noticeMessage || "（特になし）"}

内容の確認をお願いいたします！📝`;

        await sendMembersNotification(chatTemplate);
      }

    } catch (error) {
      console.error(error);
    } finally {
      setSubmitting(false);
      setModalTargetStatus(null);
      setNoticeMessage("");
    }
  };

  return (
    <div className="max-w-full mx-auto pb-20 text-slate-900 font-sans antialiased">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        
        {/* 事前準備ガイドメッセージセクション */}
        <section className="bg-slate-50 border-2 border-dashed border-slate-300 rounded p-3.5 space-y-2 shadow-inner">
          <div className="flex items-start gap-2">
            <span className="text-xs">💡</span>
            <div className="space-y-1">
              <h3 className="text-xs font-black text-slate-800">
                {/* 💡【修正】選ばれた種類に合わせて見出しを自動調整 */}
                {jobType === 'form_posting' ? '✉️ フォーム投稿案件の事前準備' 
                 : jobType === 'list_creation' ? '📋 リスト作成案件の事前準備'
                 : `${jobType} 案件の事前準備`}
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
            ) : jobType === 'list_creation' ? (
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
            ) : (
              // 💡【追加】カスタム種類が選ばれたときの汎用ガイドメッセージ
              <div className="bg-white border border-slate-300 text-slate-700 text-[10px] font-black px-2.5 py-1 rounded shadow-sm inline-flex items-center gap-1">
                📝 追加されたお仕事の種類です。必要に応じて作業詳細にマニュアルなどを追加してください。
              </div>
            )}
          </div>
        </section>

        {/* 1. 基本設定セクション */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#5CA685] pl-2">基本設定</h2>
          <div className="bg-white p-4 rounded border-2 border-slate-300 space-y-4 shadow-sm">
            
            {/* 💡【改修】お仕事の種類マスター管理連携 */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">お仕事の種類</label>
                <button 
                  type="button" 
                  onClick={() => setJobTypeSettingsOpen(true)}
                  className="text-[10px] font-black text-[#5CA685] hover:underline cursor-pointer flex items-center gap-1"
                >
                  ⚙️ 種類を追加・管理
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button 
                  type="button"
                  onClick={() => setJobType('form_posting')}
                  className={`py-2 px-3 rounded border-2 text-[11px] font-black transition-colors ${
                    jobType === 'form_posting' 
                      ? 'bg-[#5CA685] text-white border-transparent shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  ✉️ フォーム投稿
                </button>
                <button 
                  type="button"
                  onClick={() => setJobType('list_creation')}
                  className={`py-2 px-3 rounded border-2 text-[11px] font-black transition-colors ${
                    jobType === 'list_creation' 
                      ? 'bg-[#5CA685] text-white border-transparent shadow-sm' 
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}
                >
                  📋 リスト作成
                </button>
                {customJobTypes.map(cType => (
                  <button 
                    key={cType.id}
                    type="button"
                    onClick={() => setJobType(cType.name)}
                    className={`py-2 px-3 rounded border-2 text-[11px] font-black transition-colors ${
                      jobType === cType.name 
                        ? 'bg-[#5CA685] text-white border-transparent shadow-sm' 
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {cType.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">案件タイトル</label>
              <input 
                required
                className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#5CA685] transition-colors" 
                placeholder="例：問い合わせフォーム投稿業務（〇〇月度）"
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
              />
              <button type="submit" id="hidden-submit-trigger" className="hidden" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">作業件数</label>
                <input type="number" className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#5CA685]" value={formData.count} onChange={e => setFormData({...formData, count: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">募集人数</label>
                <input type="number" className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#5CA685]" value={formData.workerLimit} onChange={e => setFormData({...formData, workerLimit: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">優先度</label>
                <select className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#5CA685]" value={formData.urgency} onChange={e => setFormData({...formData, urgency: e.target.value})}>
                  <option value="1">通常</option>
                  <option value="2">高め</option>
                  <option value="3">至急</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">期日</label>
              <input type="date" className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#5CA685]" value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})} />
            </div>
          </div>
        </section>

        {/* 2. 作業詳細セクション（一律化対応済） */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-[#5CA685] pl-2">作業詳細（リンク・指示書設定）</h2>
          <div className="bg-white p-4 rounded border-2 border-slate-300 space-y-4 shadow-sm">
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                SCクライアント名 <span className="text-emerald-700 font-bold">（固定）</span>
              </label>
              <input 
                className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#5CA685] transition-colors" 
                placeholder="案件に紐づくクライアント名を入力"
                value={formData.scClient}
                onChange={e => setFormData({...formData, scClient: e.target.value})} 
              />
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  作業用リンク・指示テキスト項目（自由追加）
                </label>
                <span className="text-[10px] text-slate-400 font-bold">全 {formData.detailItems.length} 項目</span>
              </div>

              <div className="space-y-2">
                {formData.detailItems.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded border-2 border-slate-200 space-y-2 relative group">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <input 
                        type="text"
                        className="flex-1 p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#5CA685]"
                        placeholder="項目名（例: 指示書、抽出サイト）"
                        value={item.title}
                        onChange={e => handleDetailItemChange(idx, "title", e.target.value)}
                      />
                      <select 
                        className="p-2 bg-white border-2 border-slate-300 rounded text-xs font-black outline-none focus:border-[#5CA685] shrink-0"
                        value={item.type}
                        onChange={e => handleDetailItemChange(idx, "type", e.target.value as 'link' | 'text')}
                      >
                        <option value="link">🔗 リンク (URL)</option>
                        <option value="text">📝 テキスト</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveDetailItem(idx)}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-colors shrink-0 cursor-pointer"
                        title="この項目を削除"
                      >
                        🗑️
                      </button>
                    </div>

                    {item.type === 'link' ? (
                      <div className="flex gap-2">
                        <input 
                          type="url"
                          className="flex-1 p-2 bg-white border-2 border-slate-300 rounded text-xs font-mono font-medium outline-none focus:border-[#5CA685]"
                          placeholder="https://docs.google.com/... などのURLを入力"
                          value={item.value}
                          onChange={e => handleDetailItemChange(idx, "value", e.target.value)}
                        />
                        {isValidUrl(item.value) && (
                          <a href={item.value} target="_blank" rel="noopener noreferrer" className="bg-slate-100 hover:bg-slate-200 border-2 border-slate-300 px-3 flex items-center rounded text-[11px] font-black text-[#5CA685] whitespace-nowrap transition-colors">
                            ↗ 開く
                          </a>
                        )}
                      </div>
                    ) : (
                      <textarea 
                        rows={2}
                        className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#5CA685]"
                        placeholder="ワーカーへ指示する内容を入力してください"
                        value={item.value}
                        onChange={e => handleDetailItemChange(idx, "value", e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddDetailItem}
                className="w-full py-2.5 bg-white border-2 border-dashed border-[#5CA685] text-[#5CA685] hover:bg-emerald-50 rounded text-xs font-black transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                ➕ 作業詳細の項目を追加する
              </button>
            </div>
          </div>
        </section>

        {/* 3. 作業手順セクション（動的追加対応済） */}
        <section className="space-y-2">
          <div className="flex justify-between items-end border-l-2 border-emerald-600 pl-2">
            <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
              具体的な手順 ({formData.procedures.length}ステップ)
            </h2>
          </div>
          
          <div className="bg-slate-50 border-2 border-slate-200 rounded p-2 shadow-sm space-y-2">
            <div className="divide-y-2 divide-slate-200 border-2 border-slate-200 rounded overflow-hidden bg-white">
              {formData.procedures.map((p, i) => (
                <div key={i} className="flex gap-2 items-center p-2.5 hover:bg-slate-50 transition-colors">
                  <span className="text-[11px] bg-slate-100 border border-slate-300 text-slate-500 px-1.5 py-0.5 font-mono font-bold rounded shrink-0">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <input 
                    className="flex-1 p-1.5 bg-white border border-slate-300 rounded text-xs font-medium outline-none focus:border-[#5CA685]" 
                    placeholder={`手順 ${i + 1} の内容を入力`}
                    value={p}
                    onChange={e => handleProcedureChange(i, e.target.value)}
                  />
                  {formData.procedures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveProcedure(i)}
                      className="text-slate-400 hover:text-rose-600 transition-colors px-2 shrink-0 cursor-pointer"
                      title={`手順 ${i + 1} を削除`}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddProcedure}
              className="w-full py-2 bg-white border-2 border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded text-xs font-black transition-colors cursor-pointer"
            >
              ➕ 手順ステップを追加する
            </button>
          </div>
        </section>

        {/* メモ欄 */}
        <section className="space-y-2">
          <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-wider border-l-2 border-amber-500 pl-2">メモ欄</h2>
          <div className="bg-white border-2 border-slate-300 rounded p-4 shadow-sm">
            <textarea 
              rows={4} 
              className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#5CA685]" 
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
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 rounded text-xs font-black transition-colors cursor-pointer"
          >
            キャンセル
          </button>
          
          <div className="flex gap-2">
            <button 
              type="button"
              onClick={() => triggerSubmitModal('draft')}
              disabled={submitting}
              className="px-4 py-2 bg-white border-2 border-slate-300 text-slate-800 rounded text-xs font-black hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer"
            >
              {existingJobId ? "下書きとして上書き保存" : "下書きとして保存"}
            </button>
            <button 
              type="button"
              onClick={() => triggerSubmitModal('open')}
              disabled={submitting}
              className="px-5 py-2 bg-[#5CA685] hover:bg-[#4A9272] text-white border border-black/10 rounded text-xs font-bold disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
            >
              {submitting ? "処理中..." : existingJobId ? "公開状態で上書き保存" : "案件を公開する"}
            </button>
          </div>
        </div>
      </form>

      {/* 💡【新設】お仕事種類の管理・追加用モーダル */}
      {jobTypeSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-[60] font-sans antialiased">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            <div className="bg-[#5CA685] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>⚙️ お仕事の種類の追加・管理</span>
            </div>
            <div className="p-6 bg-white space-y-4">
              <p className="text-[11px] font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                新しいお仕事の種類を追加したり、不要になった種類を削除できます。（※基本の2種類はシステム固定のため削除できません）
              </p>
              
              <div className="space-y-2">
                {/* 基本タイプ表示（固定） */}
                <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-2.5 rounded">
                  <span className="text-xs font-bold text-slate-500">✉️ フォーム投稿</span>
                  <span className="text-[9px] text-slate-400 font-bold bg-white px-1.5 py-0.5 border border-slate-200 rounded">固定</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-2.5 rounded">
                  <span className="text-xs font-bold text-slate-500">📋 リスト作成</span>
                  <span className="text-[9px] text-slate-400 font-bold bg-white px-1.5 py-0.5 border border-slate-200 rounded">固定</span>
                </div>
                
                {/* オーナーが追加したカスタムタイプ一覧 */}
                {customJobTypes.map(c => (
                  <div key={c.id} className="flex justify-between items-center bg-white border-2 border-slate-200 p-2 rounded shadow-2xs">
                    <span className="text-xs font-bold text-slate-800 pl-1">{c.name}</span>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteJobType(c.id, c.name)}
                      disabled={isUpdatingJobType}
                      className="text-slate-400 hover:text-rose-600 p-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                      title="この種類を削除"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>

              {/* 新規追加入力フォーム */}
              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <input 
                  type="text" 
                  placeholder="追加する名前（例：🎥 動画編集）" 
                  value={newJobTypeName}
                  onChange={(e) => setNewJobTypeName(e.target.value)}
                  className="flex-1 p-2 bg-white border-2 border-slate-300 rounded text-xs font-bold outline-none focus:border-[#5CA685]"
                />
                <button 
                  type="button"
                  onClick={handleAddJobType}
                  disabled={isUpdatingJobType || !newJobTypeName.trim()}
                  className="px-4 bg-[#5CA685] hover:bg-[#4A9272] text-white font-black text-xs rounded transition-colors shadow-sm disabled:opacity-50 cursor-pointer shrink-0"
                >
                  追加
                </button>
              </div>
              
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => setJobTypeSettingsOpen(false)}
                className="px-6 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* サブミット確認モーダル */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[4px] flex items-center justify-center p-4 z-50 font-sans antialiased transition-all">
          <div className="bg-white border border-slate-200 w-full max-w-sm rounded-lg shadow-xl overflow-hidden text-slate-900">
            <div className="bg-[#5CA685] text-white px-4 py-3 font-black text-xs flex justify-between items-center tracking-wide select-none">
              <span>{modalTitle}</span>
            </div>
            <div className="p-6 bg-white space-y-4">
              <p className="text-xs font-bold text-slate-600 leading-relaxed whitespace-pre-wrap">
                {modalMessage}
              </p>

              {modalTargetStatus === 'open' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
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

                  {shouldNotify && (
                    <div className="space-y-1 animate-fadeIn">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        💬 チャット通知メッセージの入力
                      </label>
                      <textarea
                        rows={3}
                        className="w-full p-2 bg-white border-2 border-slate-300 rounded text-xs font-medium outline-none focus:border-[#5CA685]"
                        placeholder="チャットツールの『💭申し送り内容：』の部分に掲載される文章を入力してください。"
                        value={noticeMessage}
                        onChange={e => setNoticeMessage(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex border-t border-slate-100 bg-slate-50/50 p-3 justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-600 font-black text-xs rounded transition-colors outline-none tracking-wide cursor-pointer"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleModalConfirm}
                className="px-4 py-2 bg-[#5CA685] hover:bg-[#4A9272] text-white font-black text-xs rounded transition-colors outline-none tracking-wide shadow-sm cursor-pointer"
              >
                {modalTargetStatus === 'open' 
                  ? (shouldNotify ? "はい、通知して公開する" : "はい、通知なしで公開する")
                  : "はい、実行する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}