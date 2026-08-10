create index if not exists idx_community_user_reports_evidence_post_id
  on public.community_user_reports(evidence_post_id)
  where evidence_post_id is not null;

create index if not exists idx_community_user_reports_evidence_comment_id
  on public.community_user_reports(evidence_comment_id)
  where evidence_comment_id is not null;

create index if not exists idx_community_user_reports_resolved_by
  on public.community_user_reports(resolved_by)
  where resolved_by is not null;

create index if not exists idx_community_user_sanctions_banned_by
  on public.community_user_sanctions(banned_by)
  where banned_by is not null;

create index if not exists idx_community_user_sanctions_lifted_by
  on public.community_user_sanctions(lifted_by)
  where lifted_by is not null;
