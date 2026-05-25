"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import OwnerShell from "@/components/OwnerShell";

// デフォルトのテンプレート定義
const DEFAULT_FIELDS = [
  { id: "workerName", label: "ワーカー名", defaultHeader: "氏名", enabled: true },
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
          setFields(snap.data().fields);
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

  if (authLoading || loading) return <OwnerShell title="Settings">Loading...</OwnerShell>;

  return (
    <OwnerShell title="Settings" subTitle="CSV出力テンプレート設定">
      <div className="max-w-4xl space-y-8 font-sans text-slate-900 pb-20">
        
        <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-3">
          <span className="text-lg">⚙️</span>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            ここで設定した項目と列名の順番で、報酬支払い用のCSVデータが生成されます。<br />
            不要な項目はチェックを外して無効化してください。
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">有効</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">データ項目</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">CSV列名（ヘッダー）</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">順序</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fields.map((field, index) => (
                <tr key={field.id} className={field.enabled ? "bg-white" : "bg-slate-50/50 opacity-60"}>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={field.enabled} 
                      onChange={() => handleToggle(field.id)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[11px] font-bold text-slate-700">{field.label}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{field.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      value={field.defaultHeader} 
                      onChange={(e) => handleHeaderChange(field.id, e.target.value)}
                      disabled={!field.enabled}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] outline-none focus:border-indigo-300 transition-all"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => moveField(index, 'up')} className="p-1 hover:bg-slate-100 rounded text-slate-400">▲</button>
                      <button onClick={() => moveField(index, 'down')} className="p-1 hover:bg-slate-100 rounded text-slate-400">▼</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={saveSettings}
            disabled={saving}
            className="bg-indigo-600 text-white px-8 py-3 rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {saving ? "保存中..." : "設定を保存する"}
          </button>
        </div>
      </div>
    </OwnerShell>
  );
}