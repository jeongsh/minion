import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const client = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;
  const publisherId = client?.replace(/^ca-/, "");

  if (!publisherId?.startsWith("pub-")) {
    return new NextResponse("AdSense publisher ID is not configured.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(
    `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`,
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
