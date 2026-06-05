"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

// デフォルトのテンプレート定義
const DEFAULT_FIELDS = [
  { id: "workerName", label: "ワーカー名", defaultHeader: "氏名", enabled: true },
  { id: "scClient", label: "SCクライアント", defaultHeader: "SCクライアント", enabled: true },
  { id: "jobTitle", label: "案件名", defaultHeader: "案件名", enabled: true },
  { id: "jobType", label: "仕事種別", defaultHeader: "区分", enabled: true },
  { id: "durationHours", label: "稼働時間 (時間)", defaultHeader: "稼働時間(h)", enabled: true },
  { id: "workCount", label: "完了件数", defaultHeader: "件数", enabled: true },
  { id: "completedAt", label: "完了日", defaultHeader: "完了日", enabled: true },
  { id: "status", label: "ステータス", defaultHeader: "状態", enabled: false },
];

export default function OwnerSettingsPage() {
  const { user, loading: authLoading } = useRequireAuth("owner");
  const [fields, setFields] = useState<any[]>(DEFAULT_FIELDS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "settings", "csv_template"));
        if (snap.exists()) {
          const savedFields = snap.data().fields;
          
          const merged = DEFAULT_FIELDS.map(df => {
            const saved = savedFields.find((sf: any) => sf.id === df.id);
            return saved ? saved : df;
          });
          
          setFields(merged);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchSettings();
  }, [user, authLoading]);

  const handleToggle = (id: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
  };

  const handleHeaderChange = (id: string, newHeader: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, defaultHeader: newHeader } : f));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "settings", "csv_template"), {
        fields,
        updatedAt: new Date()
      });
      alert("設定を保存しました。次回のCSV出力から反映されます。");
    } catch (e) {
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) return <OwnerShell title="システム設定"><div className="p-10 text-slate-400 text-center text-xs font-bold">データを読み込み中...</div></OwnerShell>;

  return (
    <OwnerShell title="システム設定" subTitle="CSV出力テンプレートの管理">
      <div className="max-w-full mx-auto space-y-4 pb-20 text-slate-900 font-sans antialiased">
        
        {/* 1. ガイドインフォパネル：太枠線とパキッとしたグレー背景 */}
        <div className="bg-slate-50 border-2 border-slate-300 p-4 rounded flex items-start gap-3 shadow-sm">
          <span className="text-lg">⚙️</span>
          <p className="text-[11px] text-slate-600 leading-relaxed font-bold">
            ここで設定した項目と列名の順番で、報酬支払い用のCSVデータが生成されます。<br />
            外部の会計ソフトや管理システムに合わせて、不要な項目の無効化や名称の変更を行ってください。
          </p>
        </div>

        {/* 2. テンプレート設定テーブル：格子状のデータ仕切りを適用 */}
        <div className="bg-white border-2 border-slate-300 rounded overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-auto">
              <thead className="bg-slate-100 border-b-2 border-slate-300 text-xs text-slate-700 font-black">
                <tr>
                  <th className="p-3 border-r border-slate-300 w-16 text-center">有効</th>
                  <th className="p-3 border-r border-slate-300 w-56">データ項目</th>
                  <th className="p-3 border-r border-slate-300">CSV列名（ヘッダー）</th>
                  <th className="p-3 w-24 text-center">表示順</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
                {fields.map((field, index) => (
                  <tr 
                    key={field.id} 
                    className={`${field.enabled ? "bg-white" : "bg-slate-50 opacity-40"} transition-colors hover:bg-slate-50/60`}
                  >
                    {/* チェックボックスエリア */}
                    <td className="p-3 border-r border-slate-200 text-center">
                      <input 
                        type="checkbox" 
                        checked={field.enabled} 
                        onChange={() => handleToggle(field.id)}
                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-0 focus:ring-offset-0 outline-none accent-[#0082C8]"
                      />
                    </td>
                    
                    {/* 項目名表示 */}
                    <td className="p-3 border-r border-slate-200">
                      <div className="font-black text-slate-900">{field.label}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{field.id}</div>
                    </td>
                    
                    {/* 列名変更フォーム：白背景＋太枠線。無効時はしっかりグレーアウト */}
                    <td className="p-3 border-r border-slate-200">
                      <input 
                        type="text" 
                        value={field.defaultHeader} 
                        onChange={(e) => handleHeaderChange(field.id, e.target.value)}
                        disabled={!field.enabled}
                        className="w-full bg-white disabled:bg-slate-100 border-2 border-slate-300 disabled:border-slate-200 rounded px-2 py-1.5 text-xs font-bold outline-none focus:border-[#0082C8] transition-colors"
                        placeholder="列名を入力"
                      />
                    </td>
                    
                    {/* 順序入れ替えボタン */}
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        <button 
                          onClick={() => moveField(index, 'up')} 
                          disabled={index === 0}
                          className="p-1 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-600 transition-colors font-bold text-[10px]"
                        >
                          ▲
                        </button>
                        <button 
                          onClick={() => moveField(index, 'down')} 
                          disabled={index === fields.length - 1}
                          className="p-1 bg-white border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-600 transition-colors font-bold text-[10px]"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. 右下アクションエリア：統一したクリーンブルーのフラットボタン */}
        <div className="flex justify-end pt-2">
          <button 
            onClick={saveSettings}
            disabled={saving}
            className="bg-[#0082C8] hover:bg-[#0072B5] text-white border border-black/10 px-8 py-2.5 rounded text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? "保存中..." : "設定を保存する"}
          </button>
        </div>
      </div>
    </OwnerShell>
  );
}