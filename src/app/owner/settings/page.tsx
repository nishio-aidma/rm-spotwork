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

  if (authLoading || loading) return <OwnerShell title="システム設定"><div className="p-10 text-slate-400 text-center text-sm">読み込み中...</div></OwnerShell>;

  return (
    <OwnerShell title="システム設定" subTitle="CSV出力テンプレートの管理">
      <div className="max-w-4xl space-y-8 font-sans text-slate-800 pb-20">
        
        {/* インフォメーション */}
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-start gap-4 shadow-sm">
          <span className="text-xl">⚙️</span>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            ここで設定した項目と列名の順番で、報酬支払い用のCSVデータが生成されます。<br />
            外部の会計ソフトや管理システムに合わせて、不要な項目の無効化や名称の変更を行ってください。
          </p>
        </div>

        {/* 設定テーブル */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest w-16">有効</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">データ項目</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">CSV列名（ヘッダー）</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">表示順</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map((field, index) => (
                <tr key={field.id} className={`${field.enabled ? "bg-white" : "bg-slate-50/50 opacity-50"} transition-all`}>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="checkbox" 
                      checked={field.enabled} 
                      onChange={() => handleToggle(field.id)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[12px] font-bold text-slate-700">{field.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{field.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      value={field.defaultHeader} 
                      onChange={(e) => handleHeaderChange(field.id, e.target.value)}
                      disabled={!field.enabled}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-[12px] font-medium outline-none focus:border-slate-400 focus:bg-white transition-all"
                      placeholder="列名を入力"
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button 
                        onClick={() => moveField(index, 'up')} 
                        disabled={index === 0}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 disabled:opacity-20 transition-colors"
                      >
                        <span className="text-xs">▲</span>
                      </button>
                      <button 
                        onClick={() => moveField(index, 'down')} 
                        disabled={index === fields.length - 1}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 disabled:opacity-20 transition-colors"
                      >
                        <span className="text-xs">▼</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <button 
            onClick={saveSettings}
            disabled={saving}
            className="bg-slate-900 text-white px-10 py-3.5 rounded-2xl text-[11px] font-bold shadow-lg hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            {saving ? "保存中..." : "設定を保存する"}
          </button>
        </div>
      </div>
    </OwnerShell>
  );
}