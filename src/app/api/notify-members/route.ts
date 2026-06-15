import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { roomId, message, companyName, status, inviteDate, joinDate, updatedFields, currentUrl } = data;
    
    // トークンをコード内部に固定焼き付け (仕様保持)
    const token = "2DdB80HEyHWjO6cnN4YHyjdVR0oNyYebTAuurtFQX0vzZOLh3LhIDltLp45c99BibB5SnG0GcRV2zR35";

    if (!roomId || roomId.length !== 6) {
      return NextResponse.json({ error: "ルームID（6桁）が特定できません。" }, { status: 400 });
    }

    // 直接メッセージ文章（message）が届いたらそれを使い、なければ支援準備用のレイアウトを自動生成する
    let messageBody = message || "";
    
    if (!messageBody) {
      messageBody = `📢 【支援準備】更新のお知らせ\n\n` +
        `🏢 クライアント名: ${companyName}\n` +
        `📊 全体進捗ステータス: 【 ${status} 】\n` +
        `------------------------------------------\n`;
      
      if (updatedFields && updatedFields.length > 0) {
        messageBody += `🔧 今回変更された内容:\n${updatedFields.map((f: string) => ` ・ ${f}`).join("\n")}\n`;
      } else {
        messageBody += `📝 マスタデータが上書き保存されました（項目の変更なし）\n`;
      }

      messageBody += `------------------------------------------\n` +
        `📅 MEMBERS招待日: ${inviteDate || "未入力"}\n` +
        `📅 MEMBERS参加日: ${joinDate || "未入力"}\n` +
        `------------------------------------------\n` +
        `🔗 管理画面で確認:\n${currentUrl || "URL取得失敗"}\n\n` +
        `システムから自動送信されました。進捗確認をお願いします。`;
    }

    // 👑 「mem-bers（e）」の正しいドメインへ通信
    const memberUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/members`;

    const memberController = new AbortController();
    const memberTimeoutId = setTimeout(() => memberController.abort(), 10000);

    const memberRes = await fetch(memberUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` },
      signal: memberController.signal
    });

    clearTimeout(memberTimeoutId);

    let allMemberIds = "";
    if (memberRes.ok) {
      const memberJson = await memberRes.json();
      const memberIds = (memberJson.member || []).map((obj: any) => obj.id);
      allMemberIds = memberIds.join(",");
    }

    // 👑 メッセージ投稿側
    const postUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/messages`;
    const formData = new URLSearchParams();
    formData.append("body", messageBody);
    formData.append("to_id", allMemberIds);

    const postController = new AbortController();
    const postTimeoutId = setTimeout(() => postController.abort(), 10000);

    const postRes = await fetch(postUrl, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString(),
      signal: postController.signal
    });

    clearTimeout(postController.signal ? postTimeoutId : 0); // 安全なクリア処理

    if (!postRes.ok) {
      const rawPostError = await postRes.text();
      return NextResponse.json({ error: `メッセージ投稿失敗: ${rawPostError}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}