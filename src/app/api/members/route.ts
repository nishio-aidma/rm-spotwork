import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 画面から届いたデータを取得
    const data = await request.json().catch((e) => {
      throw new Error(`リクエストデータの解析に失敗しました: ${e.message}`);
    });
    
    const { message } = data;

    // 💡【確定仕様】本番サーバーで環境変数が見失われるリスクをゼロにするため、両方ともコード内に直接固定します
    const token = "2DdB80HEyHWjO6cnN4YHyjdVR0oNyYebTAuurtFQX0vzZOLh3LhIDltLp45c99BibB5SnG0GcRV2zR35";
    const roomId = "288932";

    // 1. チャットルームのメンバー一覧を取得（サーバー間通信）
    const memberUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/members`;
    console.log(`[MEMBERS] メンバー取得開始: ${memberUrl}`);
    
    const memberRes = await fetch(memberUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    }).catch((e) => {
      throw new Error(`メンバー一覧取得の通信自体に失敗しました: ${e.message}`);
    });

    let allMemberIds = "";
    if (memberRes.ok) {
      const memberJson = await memberRes.json();
      const memberIds = (memberJson.member || []).map((obj: any) => obj.id);
      allMemberIds = memberIds.join(",");
      console.log(`[MEMBERS] メンバーID取得成功: ${allMemberIds}`);
    } else {
      const errText = await memberRes.text().catch(() => "不明なエラー");
      console.error(`[MEMBERS] メンバー取得失敗ステータス: ${memberRes.status}, 詳細: ${errText}`);
    }

    // 2. 本文の組み立て（先頭に@allを付与）
    const bodyMessage = `@all\n${message}`;

    // 3. フォームデータの組み立て
    const formData = new URLSearchParams();
    formData.append("body", bodyMessage);
    formData.append("to_id", allMemberIds);

    // 4. MEMBERSのAPIへデータを送信
    const postUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/messages`;
    console.log(`[MEMBERS] メッセージ送信開始: ${postUrl}`);
    
    const postRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    }).catch((e) => {
      throw new Error(`メッセージ送信の通信自体に失敗しました: ${e.message}`);
    });

    if (!postRes.ok) {
      const rawPostError = await postRes.text().catch(() => "レスポンスの読み取り失敗");
      console.error(`[MEMBERS] メッセージ投稿失敗ステータス: ${postRes.status}, 詳細: ${rawPostError}`);
      return NextResponse.json({ error: `メッセージ投稿失敗: ${rawPostError}` }, { status: postRes.status });
    }

    console.log("[MEMBERS] チャットへの通知中継処理が完全に成功しました。");
    return NextResponse.json({ success: true });

  } catch (error: any) {
    // 💡 500エラーが発生した際、何が原因かをサーバー側・レスポンス側に完全に残します
    console.error("[MEMBERS致命的エラー]", error);
    return NextResponse.json({ error: error.message || "予期せぬサーバーエラー" }, { status: 500 });
  }
}