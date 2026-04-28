import { NextResponse } from "next/server";

const defaultScanApiUrl = "http://localhost:3000/scan";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.repoUrl !== "string") {
    return NextResponse.json({ error: "repoUrl is required" }, { status: 400 });
  }

  try {
    const upstreamResponse = await fetch(process.env.SCAN_API_URL ?? defaultScanApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ repoUrl: body.repoUrl }),
      cache: "no-store"
    });

    const payload = await upstreamResponse.json().catch(() => ({
      error: "Scanner API returned an invalid response"
    }));

    return NextResponse.json(payload, { status: upstreamResponse.status });
  } catch {
    return NextResponse.json(
      {
        error: "Scanner API is unavailable. Start the backend with npm run dev:api."
      },
      { status: 502 }
    );
  }
}
