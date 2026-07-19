import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { COMMUNITY_UPLOAD_BUCKET } from "@/lib/community/upload-security";

const DEFAULT_MAX_AGE_HOURS = 24;

function parseMaxAgeHours() {
  const raw = process.argv.find((arg) => arg.startsWith("--max-age-hours="))?.split("=")[1];
  const value = raw ? Number(raw) : DEFAULT_MAX_AGE_HOURS;
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_AGE_HOURS;
}

async function main() {
  const maxAgeHours = parseMaxAgeHours();
  const dryRun = !process.argv.includes("--confirm");
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("community_uploads")
    .select("id,object_path,public_url")
    .eq("status", "uploaded")
    .lt("created_at", cutoff)
    .limit(200);

  if (error) throw error;
  const candidates = data ?? [];
  if (!candidates.length) {
    console.log("No stale community uploads found.");
    return;
  }

  const urls = candidates.map((item) => item.public_url).filter(Boolean);
  const { data: referencedPosts, error: postError } = await supabase
    .from("community_posts")
    .select("id,content")
    .or(urls.map((url) => `content.ilike.%${url}%`).join(","));
  if (postError) throw postError;

  const { data: referencedComments, error: commentError } = await supabase
    .from("community_comments")
    .select("id,content")
    .or(urls.map((url) => `content.ilike.%${url}%`).join(","));
  if (commentError) throw commentError;

  const referencedText = `${JSON.stringify(referencedPosts ?? [])}\n${JSON.stringify(referencedComments ?? [])}`;
  const orphaned = candidates.filter((item) => item.public_url && !referencedText.includes(item.public_url));

  console.log(`Candidates: ${candidates.length}`);
  console.log(`Orphaned: ${orphaned.length}`);
  if (dryRun || !orphaned.length) {
    console.log("Dry run only. Re-run with --confirm to remove orphaned files.");
    return;
  }

  const paths = orphaned.map((item) => item.object_path);
  const { error: removeError } = await supabase.storage.from(COMMUNITY_UPLOAD_BUCKET).remove(paths);
  if (removeError) throw removeError;

  const { error: updateError } = await supabase
    .from("community_uploads")
    .update({ status: "deleted", deleted_at: new Date().toISOString() })
    .in("id", orphaned.map((item) => item.id));
  if (updateError) throw updateError;

  console.log(`Removed ${orphaned.length} orphaned community uploads.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
