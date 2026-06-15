import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { getTeamByFanSiteHost, getTeamBySlug, getTeamNews } from "@/lib/data/lck";

export default async function FanNewsPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));

  if (!team) {
    notFound();
  }

  const news = await getTeamNews(team.id);
  const rows = [
    ...news.videos.map((video) => ({
      type: "영상",
      title: video.title,
      source: video.platform,
      publishedAt: video.publishedAt,
    })),
    ...news.socialPosts.map((post) => ({
      type: "SNS",
      title: post.title,
      source: post.platform,
      publishedAt: post.publishedAt,
    })),
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={team.shortName} title="팀 소식" />
      <DataTable
        rows={rows}
        columns={[
          { key: "type", label: "유형", render: (row) => row.type },
          { key: "title", label: "제목", render: (row) => row.title },
          { key: "source", label: "출처", render: (row) => row.source },
          {
            key: "published",
            label: "게시일",
            render: (row) => row.publishedAt ? new Date(row.publishedAt).toLocaleDateString("ko-KR") : "-",
          },
        ]}
      />
    </main>
  );
}
