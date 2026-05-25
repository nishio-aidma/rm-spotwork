"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

export default function NewJobPage() {
  const { user } = useRequireAuth("owner");
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [jobType, setJobType] = useState<"form_posting" | "list_creation">("form_posting");
  
  // 基本項目（数値は"0"がデフォルト）
  const [title, setTitle] = useState("");
  const [reward, setReward] = useState("0");
  const [count, setCount] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [urgency, setUrgency] = useState("1");
  const [description, setDescription] = useState("");

  // 作業手順（追加・削除ができるリスト）
  const [procedures, setProcedures] = useState([""]);

  // 「フォーム投稿」専用の項目
  const [formContent, setFormContent] = useState("");
  const [inputInfo, setInputInfo] = useState("");

  // 「リスト作成」専用の項目
  const [siteUrl, setSiteUrl] = useState("");
  const [targetItems, setTargetItems] = useState("");

  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "list_creation") setJobType("list_creation");
    
    const urlParam = searchParams.get("url");
    const titleParam = searchParams.get("title");
    if (urlParam && titleParam) {
      setTitle(titleParam);
      setSiteUrl(urlParam);
    }
  }, [searchParams]);

  const addStep = () => setProcedures([...procedures, ""]);
  const updateStep = (index: number, val: string) => {
    const newSteps = [...procedures];
    newSteps[index] = val;
    setProcedures(newSteps);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      await addDoc(collection(db, "jobs"), {
        ownerId: user.uid,
        jobType,
        title,
        reward: Number(reward),
        count: Number(count),
        deadline,
        urgency,
        procedures: procedures.filter(p => p.trim() !== ""),
        description,
        // 種別によって保存する内容を分ける
        formContent: jobType === "form_posting" ? formContent : null,
        inputInfo: jobType === "form_posting" ? inputInfo : null,
        siteUrl: jobType === "list_creation" ? siteUrl : null,
        targetItems: jobType === "list_creation" ? targetItems : null,
        status: "open",
        createdAt: serverTimestamp(),
      });
      router.push("/owner/dashboard");
    } catch (error) {
      console.error(error);
      alert("エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OwnerShell title="案件の新規作成" subTitle="案件管理">
      <div className="max-w-4xl mx-auto pb-20">
        
        {/* 案件種別の切り替え */}
        <div className="flex gap-8 mb-12 border-b border-slate-100">
          <button 
            type="button"
            onClick={() => setJobType("form_posting")}
            className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${jobType === 'form_posting' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-300'}`}
          >
            ✉️ フォーム投稿
          </button>
          <button 
            type="button"
            onClick={() => setJobType("list_creation")}
            className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${jobType === 'list_creation' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-300'}`}
          >
            📋 リスト作成
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-12">
          
          {/* タイトルと報酬 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
            <div className="md:col-span-3 border-b border-slate-200 pb-2 focus-within:border-indigo-400 transition-all">
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">案件タイトル</label>
              <input type="text" required className="w-full bg-transparent text-xl font-bold outline-none" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="案件の名前を入力してください" />
            </div>
            <div className="border-b border-slate-200 pb-2 focus-within:border-indigo-400 transition-all">
              <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">報酬 (1件あたり/円)</label>
              <input type="number" required className="w-full bg-transparent text-right font-bold outline-none" value={reward} onChange={(e) => setReward(e.target.value)} />
            </div>
          </div>

          {/* 件数・期日・緊急度 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="border-b border-slate-200 pb-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">予定件数</label>
              <input type="number" required className="w-full bg-transparent outline-none font-bold" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div className="border-b border-slate-200 pb-2">
              <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">期日（締め切り）</label>
              <input type="date" required className="w-full bg-transparent outline-none cursor-pointer" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="border-b border-indigo-200 bg-indigo-50/30 px-2 rounded-t">
              <label className="text-[9px] font-black text-indigo-500 uppercase block mb-1">緊急度</label>
              <select className="w-full bg-transparent text-sm font-bold outline-none cursor-pointer py-1" value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value="1">低（通常）</option>
                <option value="2">中（優先的に表示）</option>
                <option value="3">高（最優先で表示）</option>
              </select>
            </div>
          </div>

          {/* 案件種別ごとの入力エリア */}
          <div className="bg-slate-50/50 p-6 rounded-2xl space-y-8">
            {jobType === "form_posting" ? (
              <>
                <div className="border-b border-slate-200 pb-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">フォームに投稿する文面</label>
                  <textarea className="w-full bg-transparent text-sm outline-none h-24 resize-none" value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder="送信する内容を入力してください..." />
                </div>
                <div className="border-b border-slate-200 pb-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">入力が必要な情報</label>
                  <input type="text" className="w-full bg-transparent text-sm outline-none" value={inputInfo} onChange={(e) => setInputInfo(e.target.value)} placeholder="氏名、メールアドレスなどワーカーが入れるべき情報" />
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-slate-200 pb-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">参照サイトのURL</label>
                  <input type="url" className="w-full bg-transparent text-sm outline-none font-mono" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" />
                </div>
                <div className="border-b border-slate-200 pb-2">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">抽出する項目</label>
                  <input type="text" className="w-full bg-transparent text-sm outline-none" value={targetItems} onChange={(e) => setTargetItems(e.target.value)} placeholder="会社名、電話番号、住所など" />
                </div>
              </>
            )}
          </div>

          {/* 作業手順の追加 */}
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-400 uppercase block">具体的な作業手順</label>
            {procedures.map((step, idx) => (
              <div key={idx} className="flex items-center gap-4 border-b border-slate-100 pb-2">
                <span className="text-[10px] font-black text-slate-300">手順 {idx + 1}</span>
                <input 
                  type="text" 
                  className="flex-1 bg-transparent text-sm outline-none" 
                  value={step} 
                  onChange={(e) => updateStep(idx, e.target.value)}
                  placeholder="具体的な作業内容を入力..."
                />
              </div>
            ))}
            <button 
              type="button" 
              onClick={addStep}
              className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-all"
            >
              ＋ 手順を追加する
            </button>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">その他 補足事項</label>
            <textarea
              className="w-full p-4 text-sm bg-white border border-slate-200 rounded-xl h-32 outline-none focus:border-indigo-500 transition-all"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ワーカーへの伝達事項があれば入力してください"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-black disabled:opacity-50 transition-all shadow-xl shadow-slate-200"
          >
            {loading ? "作成中..." : "案件を公開する"}
          </button>
        </form>
      </div>
    </OwnerShell>
  );
}