"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import OwnerShell from "@/components/OwnerShell";
import { useRouter } from "next/navigation";

export default function OwnerSeedPage() {
  const [inserting, setInserting] = useState(false);
  const router = useRouter();

  // ★ 被りなし！現場感MAXの「追加用サンプル案件」第2弾の10件
  const sampleJobs = [
    {
      title: "＜仮＞【データ収集】全国のスタートアップ企業 資金調達情報リスト化（100件）",
      jobType: "list_creation",
      scClient: "イノベーションキャピタルパートナーズ",
      count: 100,
      workerLimit: 2,
      deadline: "2026-07-20",
      urgency: "2",
      siteUrl: "https://example.com/startup-funding-news",
      targetItems: "https://docs.google.com/spreadsheets/d/dummy-target-11",
      formContent: "",
      inputInfo: "",
      procedures: ["ニュースサイトから直近3ヶ月以内の調達ニュースをピックアップする", "調達金額・引受先ベンチャーキャピタル名を特定する", "指定スプレッドシートの各列に正確に入力する"],
      memo: "金額の単位（百万円・億円）の間違いが起きやすいので、入力時は数値を十分再確認してください。",
      reward: 0
    },
    {
      title: "＜仮＞【フォーム投稿】都内の税理士事務所向け AI確定申告ソフトの案内送信（80件）",
      jobType: "form_posting",
      scClient: "メディカル＆タックスソリューションズ",
      count: 80,
      workerLimit: 1,
      deadline: "2026-06-19",
      urgency: "3",
      siteUrl: "",
      targetItems: "",
      formContent: "https://docs.google.com/document/d/dummy-content-12",
      inputInfo: "https://docs.google.com/spreadsheets/d/dummy-info-12",
      procedures: ["税理士事務所のHP内にある『お問い合わせ』窓口を開く", "AI確定申告ソフトの導入メリットが書かれた文面URLをコピー＆ペーストする", "送信ボタンを押し、送信完了を記録する"],
      memo: "確定申告の繁忙期直前のプロモーションのため、スピード重視でお願いします！",
      reward: 0
    },
    {
      title: "＜仮＞【SNS調査】全国のフィットネスジム・ヨガスタジオ 公式Instagramアカウント収集",
      jobType: "list_creation",
      scClient: "アクティブライフマネジメント",
      count: 120,
      workerLimit: 3,
      deadline: "2026-07-15",
      urgency: "1",
      siteUrl: "https://example.com/fitness-gym-directory",
      targetItems: "https://docs.google.com/spreadsheets/d/dummy-target-13",
      formContent: "",
      inputInfo: "",
      procedures: ["一覧ナビサイトから対象の店舗HPへアクセスする", "HP内にInstagramのリンクアイコンがあるか確認する", "アカウントのURL（またはユーザー名）をスプシに記録する"],
      memo: "公式アカウントではなく、トレーナー個人のアカウントは収集対象外となります。",
      reward: 0
    },
    {
      title: "＜仮＞【定例】ECモール（楽天市場）出店中のレディースアパレル店舗URL収集（300件）",
      jobType: "list_creation",
      scClient: "トレンドスタイル株式会社",
      count: 300,
      workerLimit: 4,
      deadline: "2026-08-05",
      urgency: "1",
      siteUrl: "https://example.com/rakuten-fashion-ranking",
      targetItems: "https://docs.google.com/spreadsheets/d/dummy-target-14",
      formContent: "",
      inputInfo: "",
      procedures: ["楽天市場のファッションジャンルから出店企業を抽出する", "会社概要ページを開き、運営会社の正式名称を特定する", "ショップURLと会社名をデータシートへ格納する"],
      memo: "件数が多いため、複数人のワーカーで分担して作業を行います。重複入力にご注意ください。",
      reward: 0
    },
    {
      title: "＜仮＞【フォーム投稿】地方の老舗旅館・ホテル向け 観光インバウンド集客支援の案内（120件）",
      jobType: "form_posting",
      scClient: "グローバルツーリズムJAPAN",
      count: 120,
      workerLimit: 2,
      deadline: "2026-06-29",
      urgency: "2",
      siteUrl: "",
      targetItems: "",
      formContent: "https://docs.google.com/document/d/dummy-content-15",
      inputInfo: "https://docs.google.com/spreadsheets/d/dummy-info-15",
      procedures: ["宿泊施設リストのフォーム窓口URLを順番に叩く", "多言語サイト制作や海外広告運用の提案文面（文面URL）をセットする", "施設の種別（旅館・ビジネスホテル等）をスプシの選択肢にメモする"],
      memo: "宿泊予約向けのフォームではなく、必ず『法人・一般問い合わせ』のフォームへ投稿してください。",
      reward: 0
    },
    {
      title: "＜仮＞【医療法人調査】都内クリニックの求人ページ・採用情報の有無調査（150件）",
      jobType: "list_creation",
      scClient: "メディカルキャリアリンク",
      count: 150,
      workerLimit: 2,
      deadline: "2026-07-12",
      urgency: "2",
      siteUrl: "https://example.com/tokyo-clinic-map",
      targetItems: "https://docs.google.com/spreadsheets/d/dummy-target-16",
      formContent: "",
      inputInfo: "",
      procedures: ["対象クリニックのHPへアクセスする", "メニュー内に『採用情報』『Recruit』『求人』のページがあるか探す", "求人がある場合は『有』、ない場合は『無』としてURLを記録する"],
      memo: "現在募集が停止していても、採用専用の特設ページが存在していれば『有』と判定してください。",
      reward: 0
    },
    {
      title: "＜仮＞【フォーム投稿】全国の学習塾・予備校向け オンライン教材の導入案内（200件）",
      jobType: "form_posting",
      scClient: "エデュケーションラボ株式会社",
      count: 200,
      workerLimit: 3,
      deadline: "2026-06-22",
      urgency: "2",
      siteUrl: "",
      targetItems: "",
      formContent: "https://docs.google.com/document/d/dummy-content-17",
      inputInfo: "https://docs.google.com/spreadsheets/d/dummy-info-17",
      procedures: ["塾のホームページにアクセスし、本部の問い合わせ窓口を開く", "タブレット教材の無料体験案内（文面URL）を過不足なく貼り付ける", "必須項目を埋めて送信を完了し、ステータスを更新する"],
      memo: "個別指導塾と集団指導塾でリストのタブが分かれています。どちらのタブの企業かも確認してください。",
      reward: 0
    },
    {
      title: "＜仮＞【リスト作成】首都圏の主要コワーキングスペース 設備環境・個室数調査",
      jobType: "list_creation",
      scClient: "ワークスペースデザイン",
      count: 60,
      workerLimit: 1,
      deadline: "2026-06-26",
      urgency: "1",
      siteUrl: "https://example.com/tokyo-shareoffice-hub",
      targetItems: "https://docs.google.com/spreadsheets/d/dummy-target-18",
      formContent: "",
      inputInfo: "",
      procedures: ["オフィスの紹介ページまたは公式HPを開く", "『完全個室数』『会議室数』『Wi-Fi速度（記載あれば）』のデータを読み取る", "調査台帳シートの該当セルへ綺麗に入力する"],
      memo: "内覧予約が必要な施設については、一般公開されているフロアマップの画像から数をカウントしてください。",
      reward: 0
    },
    {
      title: "＜仮＞【フォーム投稿】建築・建設会社向け DX施工管理ツールのプロモーション（110件）",
      jobType: "form_posting",
      scClient: "コンストラクションテック・ジャパン",
      count: 110,
      workerLimit: 2,
      deadline: "2026-06-24",
      urgency: "2",
      siteUrl: "",
      targetItems: "",
      formContent: "https://docs.google.com/document/d/dummy-content-19",
      inputInfo: "https://docs.google.com/spreadsheets/d/dummy-info-19",
      procedures: ["建設会社リストのHPの『お問い合わせ・ご相談』フォームを開く", "現場のペーパーレス化・2024年問題対策ツールの案内（文面URL）を入力する", "無事に送信が通ったことを確認して完了マークを付ける"],
      memo: "エラーで送信できなかった場合は、エラー理由（文字数制限など）をリストにメモしておいてください。",
      reward: 0
    },
    {
      title: "＜仮＞【地方創生】全国の地場特産品ECサイト 運営会社および連絡先抽出（80件）",
      jobType: "list_creation",
      scClient: "ローカルギフトマーケティング",
      count: 80,
      workerLimit: 1,
      deadline: "2026-07-25",
      urgency: "2",
      siteUrl: "https://example.com/japan-local-specialties",
      targetItems: "https://docs.google.com/spreadsheets/d/dummy-target-20",
      formContent: "",
      inputInfo: "",
      procedures: ["特産品ポータルから、地方の食品系ECサイトを特定する", "特定商取引法に基づく表記のページを開き、運営社名・住所・代表者名を取り出す", "納品用データシートに整列させて記録する"],
      memo: "個人農家が直販しているサイトも含まれます。屋号（ショップ名）を会社名欄に記載してください。",
      reward: 0
    }
  ];

  const handleInsertSeed = async () => {
    if (!auth.currentUser) {
      alert("ログインしていません。オーナーアカウントでログインした状態で実行してください。");
      return;
    }

    const ok = window.confirm("現在ログイン中のオーナー権限で、第2弾のサンプル案件をさらに10件作成します。よろしいですか？");
    if (!ok) return;

    setInserting(true);
    try {
      for (const jobData of sampleJobs) {
        await addDoc(collection(db, "jobs"), {
          ...jobData,
          ownerId: auth.currentUser.uid,
          status: "open",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          totalAccumulatedSeconds: 0
        });
      }
      alert("第2弾サンプルデータ10件の追加登録に成功しました！");
      router.push("/owner/jobs");
    } catch (e) {
      console.error(e);
      alert("エラーが発生しました。");
    } finally {
      setInserting(false);
    }
  };

  return (
    <OwnerShell title="開発用データ投入" subTitle="サンプル案件の自動生成（第2弾）">
      <div className="max-w-md mx-auto bg-white border-2 border-slate-300 rounded p-6 shadow-sm space-y-4 text-center mt-10">
        <span className="text-3xl block">🚀</span>
        <h3 className="text-sm font-black text-slate-800">テスト用データ一括ジェネレーター（第2弾）</h3>
        <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
          このボタンを押すと、既存のデータを消すことなく、新しくバリエーションを変えた別のサンプルお仕事データが10件後ろに追加書き込みされます。
        </p>
        
        <button
          onClick={handleInsertSeed}
          disabled={inserting}
          className="w-full py-2.5 bg-[#0082C8] hover:bg-[#0072B5] text-white rounded text-xs font-black disabled:opacity-50 transition-colors shadow-sm"
        >
          {inserting ? "データ追加書き込み中..." : "さらに新しい案件を10件追加生成する"}
        </button>
      </div>
    </OwnerShell>
  );
}