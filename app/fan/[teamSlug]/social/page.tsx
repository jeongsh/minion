import { redirect } from "next/navigation";

export default async function FanSocialRedirectPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  redirect(`/fan/${encodeURIComponent(teamSlug)}/instagram`);
}
