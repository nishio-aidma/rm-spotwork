import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 画面から届いたデータを取得
    const data = await request.json().catch((e) => {
      throw new Error(`リクエストデータの解析に失敗しました: ${e.message}`);
    });
    
    const { message } = data;

    // 💡【確定仕様】トークンとルームIDを直接焼き付け
    const token = "2DdB80HEyHWjO6cnN4YHyjdVR0oNyYebTAuurtFQX0vzZOLh3LhIDltLp45c99BibB5SnG0GcRV2zR35";
    const roomId = "288932";

    // 1. チャットルームのメンバー一覧を取得（サーバー間通信）
    const memberUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/members`;
    
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
    }

    // 2. 本文の組み立て（先頭に@allを付与）
    const bodyMessage = `@all\n${message}`;

    // 3. フォームデータの組み立て
    const formData = new URLSearchParams();
    formData.append("body", bodyMessage);
    formData.append("to_id", allMemberIds);

    // 4. MEMBERSのAPIへデータを送信
    const postUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/messages`;
    
    const postRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        // 💡【最重要修正】お手本コードと完全に一致させるため、Content-Typeを指定します
        // これがないためにMEMBERS側から403(Forbidden)で拒否されていました
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    }).catch((e) => {
      throw new Error(`メッセージ送信の通信自体に失敗しました: ${e.message}`);
    });

    if (!postRes.ok) {
      const rawPostError = await postRes.text().catch(() => "レスポンスの読み取り失敗");
      return NextResponse.json({ error: `メッセージ投稿失敗: ${rawPostError}` }, { status: postRes.status });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "予期せぬサーバーエラー" }, { status: 500 });
  }
}