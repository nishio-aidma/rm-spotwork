import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { message } = data;

    // 💡 実績コード・.env.localをベースに、トークンとルームIDを設定
    const token = "2DdB80HEyHWjO6cnN4YHyjdVR0oNyYebTAuurtFQX0vzZOLh3LhIDltLp45c99BibB5SnG0GcRV2zR35";
    const roomId = process.env.NEXT_PUBLIC_MEMBERS_ROOM_ID || "288932";

    // 1. 中継サーバー（ここ）からMEMBERSのメンバー一覧を取得（CORSの影響を受けません）
    const memberUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/members`;
    const memberRes = await fetch(memberUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    });

    let allMemberIds = "";
    if (memberRes.ok) {
      const memberJson = await memberRes.json();
      const memberIds = (memberJson.member || []).map((obj: any) => obj.id);
      allMemberIds = memberIds.join(",");
    }

    // 2. 本文の先頭に@allを付与
    const bodyMessage = `@all\n${message}`;

    // 3. フォームデータの組み立てと送信
    const postUrl = `https://api.mem-bers.jp/web-api/rooms/${roomId}/messages`;
    const formData = new URLSearchParams();
    formData.append("body", bodyMessage);
    formData.append("to_id", allMemberIds);

    const postRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (!postRes.ok) {
      const rawPostError = await postRes.text();
      return NextResponse.json({ error: `メッセージ投稿失敗: ${rawPostError}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}