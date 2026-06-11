import { NextResponse } from "next/server";
import { google } from "googleapis";
import path from "path";
import fs from "fs";

export async function POST(request: Request) {
  try {
    const { emails, timeMin, timeMax } = await request.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ events: [] });
    }

    // 💡【環境変数不要の完全自動読み込みハック】
    // 左側に配置されているJSON鍵ファイルをシステムが直接読み込むため、コピペのズレが200%起きません。
    const jsonPath = path.join(process.cwd(), "my-gyomu-app-firebase-adminsdk-fbsvc-b6ab302292.json");
    
    if (!fs.existsSync(jsonPath)) {
      console.error(`❌ 認証JSONファイルが見つかりません。配置パス: ${jsonPath}`);
      return NextResponse.json({ error: "認証用JSONファイルがルートに配置されていません" }, { status: 500 });
    }

    // JSONファイルを直接パース
    const credentials = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
    });

    // Google認証の事前チェック
    try {
      await auth.authorize();
    } catch (authErr: any) {
      console.error("❌ Google認証に失敗しました。JSONファイルの中身を確認してください:", authErr.message);
      return NextResponse.json({ error: "Google認証に失敗しました" }, { status: 401 });
    }

    const calendar = google.calendar({ version: "v3" });
    const consolidatedEvents: any[] = [];

    await Promise.all(
      emails.map(async (email) => {
        try {
          const res = await calendar.events.list({
            auth: auth,
            calendarId: email,
            timeMin: timeMin,
            timeMax: timeMax,
            singleEvents: true,
            orderBy: "startTime",
          });

          const events = res.data.items || [];

          events.forEach((event: any) => {
            const summary = event.summary || "";
            // タイトルに「RM業務」が含まれていれば前後不問で全自動検知（部分一致）
            if (summary.includes("RM業務")) {
              const startStr = event.start?.dateTime || event.start?.date || "";
              const endStr = event.end?.dateTime || event.end?.date || "";

              if (startStr) {
                const startDate = new Date(startStr);
                const endDate = new Date(endStr);
                
                const dateKey = startStr.split("T")[0]; // YYYY-MM-DD
                const startTimeStr = String(startDate.getHours()).padStart(2, "0") + ":" + String(startDate.getMinutes()).padStart(2, "0");
                const endTimeStr = String(endDate.getHours()).padStart(2, "0") + ":" + String(endDate.getMinutes()).padStart(2, "0");

                consolidatedEvents.push({
                  workerEmail: email,
                  date: dateKey,
                  time: `${startTimeStr} - ${endTimeStr}`
                });
              }
            }
          });
        } catch (err: any) {
          console.error(`❌ カレンダー取得エラー発生 [対象アドレス: ${email}]:`, err.message);
        }
      })
    );

    return NextResponse.json({ events: consolidatedEvents });
  } catch (error: any) {
    console.error("Google Calendar API Core Error:", error);
    return NextResponse.json({ error: "カレンダー一括取得に失敗しました" }, { status: 500 });
  }
}