import { NextResponse } from "next/server";

import { getSearchResults } from "@/lib/search";

export type { SearchResult, SearchResultType } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ results: await getSearchResults(query) });
}
