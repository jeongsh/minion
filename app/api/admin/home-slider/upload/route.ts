import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const BUCKET = "home-hero-slides";

// Hero banners are curated by us, so the original file is stored as-is. This
// runs as a Route Handler rather than a Server Action because Server Action
// bodies are capped at 1MB by default.
export async function POST(request: Request) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
  }

  const slideId = ((formData?.get("slide_id") as string | null) ?? "").trim() || randomUUID();
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${slideId}/${Date.now()}.${extension}`;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
