import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchYoutubeFeedEntries, parseYoutubeFeedEntries } from "@/lib/youtube-feed";
import { findYoutubeOwnerByChannelId, upsertYoutubeVideo } from "@/lib/sync/youtube-videos";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get("hub.challenge");

  if (!challenge) {
    return new NextResponse("Missing hub.challenge", { status: 400 });
  }

  return new NextResponse(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: Request) {
  const body = await request.text();
  const pushedEntries = parseYoutubeFeedEntries(body);

  if (pushedEntries.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, updated: 0, skipped: 0 });
  }

  const supabase = createSupabaseAdminClient();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const since = new Date(process.env.YOUTUBE_VIDEO_SINCE ?? "2026-01-01T00:00:00.000Z");

  for (const pushedEntry of pushedEntries) {
    const owner = await findYoutubeOwnerByChannelId(supabase, pushedEntry.channelId);
    if (!owner) {
      skipped += 1;
      continue;
    }

    const verifiedEntry = (await fetchYoutubeFeedEntries(pushedEntry.channelId)).find(
      (entry) => entry.videoId === pushedEntry.videoId,
    );

    if (!verifiedEntry || new Date(verifiedEntry.publishedAt) < since) {
      skipped += 1;
      continue;
    }

    const result = await upsertYoutubeVideo(supabase, owner, verifiedEntry);
    if (result.inserted) inserted += 1;
    else updated += 1;
  }

  return NextResponse.json({ ok: true, inserted, updated, skipped }, { status: 202 });
}
