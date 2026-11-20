"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button, buttonClassName } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeading } from "@/components/ui/section-heading";
import { addInternationalTeamAction, searchInternationalTeamsAction } from "./actions";

type SearchResult = NonNullable<Awaited<ReturnType<typeof searchInternationalTeamsAction>>["results"]>[number];

export function LeaguepediaTeamSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [addingPage, setAddingPage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function search(formData: FormData) {
    setError("");
    setNotice("");
    setAddingPage(null);
    setResults(null);
    startTransition(async () => {
      try {
        const response = await searchInternationalTeamsAction(formData);
        if (response.results) setResults(response.results);
        else setError(response.error);
      } catch {
        setError("팀을 검색하지 못했습니다. 다시 시도해 주세요.");
      }
    });
  }

  function add(team: SearchResult) {
    setError("");
    setNotice("");
    setAddingPage(team.page);
    startTransition(async () => {
      try {
        const response = await addInternationalTeamAction(team.page);
        const { teamId } = response;
        if (!teamId) {
          setError(response.error ?? "팀을 추가하지 못했습니다. 다시 시도해 주세요.");
          return;
        }
        setResults((current) => current?.map((row) => row.page === team.page ? { ...row, teamId } : row) ?? null);
        setNotice(response.created
          ? team.name + " 팀을 추가했습니다." + (response.hasLogo ? "" : " 로고는 팀 관리에서 올릴 수 있습니다.")
          : team.name + " 팀이 이미 등록되어 있습니다.");
      } catch {
        setError("팀을 추가하지 못했습니다. 다시 시도해 주세요.");
      }
    });
  }

  return (
    <section aria-label="Leaguepedia 팀 추가">
      <SectionHeading>Leaguepedia 팀 추가</SectionHeading>
      <form action={search} className="flex max-w-lg items-center gap-2">
        <SearchInput
          aria-label="Leaguepedia 팀명 또는 약칭"
          name="query"
          placeholder="팀명 또는 약칭"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          required
          minLength={2}
          maxLength={160}
          readOnly={pending}
        />
        <Button type="submit" disabled={pending || query.trim().length < 2}>
          {pending && !addingPage ? "검색 중" : "검색"}
        </Button>
      </form>
      <div role="status">
        {notice && <p className="mt-3">{notice}</p>}
        {results?.length === 0 && <p className="mt-3 text-muted">검색 결과가 없습니다.</p>}
        {results && results.length > 0 && !notice && <span className="sr-only">검색 결과 {results.length}개</span>}
      </div>
      {error && <p role="alert" className="mt-3 text-foreground">{error}</p>}
      {results && results.length > 0 && (
        <ul className="mt-2 max-w-lg divide-y divide-border">
          {results.map((team) => (
            <li key={team.page} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="break-words text-base font-bold">{team.name}</p>
                {(team.shortName || team.region || team.disbanded) && (
                  <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                    {team.shortName && team.shortName !== team.name && <span>{team.shortName}</span>}
                    {team.region && <span>{team.region}</span>}
                    {team.disbanded && <span>해체</span>}
                  </div>
                )}
              </div>
              {team.teamId ? (
                <Link
                  href={"/admin/international-teams/" + team.teamId}
                  aria-label={team.name + " 팀 관리"}
                  className={buttonClassName({ variant: "secondary" })}
                >
                  팀 관리
                </Link>
              ) : (
                <Button variant="secondary" disabled={pending} aria-label={team.name + " 추가"} onClick={() => add(team)}>
                  {pending && addingPage === team.page ? "추가 중" : "추가"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
