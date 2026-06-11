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

    let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      const jsonPath = path.join(process.cwd(), "my-gyomu-app-firebase-adminsdk-fbsvc-b6ab302292.json");
      
      if (fs.existsSync(jsonPath)) {
        const credentials = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
        clientEmail = credentials.client_email;
        privateKey = credentials.private_key;
      }
    }

    if (!privateKey || !clientEmail) {
      console.error("❌ Google Calendar Credentials missing.");
      return NextResponse.json({ error: "API設定（認証情報）が不足しています" }, { status: 500 });
    }

    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    const formattedKey = privateKey.replace(/\\n/g, "\n");

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: formattedKey,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
    });

    try {
      await auth.authorize();
    } catch (authErr: any) {
      console.error("❌ Google認証に失敗しました:", authErr.message);
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
            if (summary.includes("RM業務")) {
              const startStr = event.start?.dateTime || event.start?.date || "";
              const endStr = event.end?.dateTime || event.end?.date || "";

              if (startStr) {
                const startDate = new Date(startStr);
                const endDate = new Date(endStr);
                
                // 💡【ここを徹底強化！】
                // Vercelサーバーがアメリカにあろうがどこにあろうが、100%強制的に日本時間（JST）の時計オブジェクトへ変換します
                const jstStart = new Date(startDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
                const jstEnd = new Date(endDate.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

                // 日付と時間を日本時間基準で美しく切り出し
                const dateKey = `${jstStart.getFullYear()}-${String(jstStart.getMonth() + 1).padStart(2, "0")}-${String(jstStart.getDate()).padStart(2, "0")}`;
                const startTimeStr = String(jstStart.getHours()).padStart(2, "0") + ":" + String(jstStart.getMinutes()).padStart(2, "0");
                const endTimeStr = String(jstEnd.getHours()).padStart(2, "0") + ":" + String(jstEnd.getMinutes()).padStart(2, "0");

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