import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import flagBuddy from "@/assets/characters/flag-4.png";
import megaphoneBuddy from "@/assets/characters/megapon-2.png";
import markerBuddy from "@/assets/characters/pen-1.png";
import type { WeeklyReportSummary } from "@/lib/reports/queries";
import type { ReportChampionStat, ReportTeamRef, WeeklyReportRow } from "@/lib/reports/types";
import styles from "./weekly-report-view.module.css";

const POSITION_LABELS: Record<string, string> = { TOP: "탑", JGL: "정글", MID: "미드", BOT: "원딜", SUP: "서포터" };
// 선수 카드 배경 워터마크용 포지션 아이콘(/public/objectives/).
const POSITION_ICON: Record<string, string> = {
  TOP: "position-top",
  JGL: "position-jungle",
  MID: "position-middle",
  BOT: "position-bottom",
  SUP: "position-utility",
};

// 방송 그래픽 시그니처: 평행사변형(기울어진) 태그. 안쪽 콘텐츠는 역기울여 수평 유지.
const SKEW = "none";
const UNSKEW: CSSProperties = { display: "inline-block" };
const DISPLAY = "'Paperozi', 'Pretendard', sans-serif";
const REPORT_POINT = "var(--report-point)";

// 레퍼런스(다크 전용)의 하드코딩 색을 우리 라이트/다크 테마 토큰으로 매핑.
const SURFACE = "var(--ui-surface)";
const LINE = "var(--ui-border)";
const FILL = "var(--ui-surface-muted)";
const INK = "var(--ui-ink)";
const BODY = "var(--ui-text)";
const MUTED = "var(--ui-muted)";
const FAINT = "color-mix(in srgb, var(--ui-muted) 68%, transparent)";
const DIM = "color-mix(in srgb, var(--ui-muted) 42%, transparent)";
const GHOST = "color-mix(in srgb, var(--ui-muted) 24%, transparent)";
// 아웃라인(선) 고스트 텍스트: 라이트모드에서 너무 진하지 않도록 서피스 쪽으로 블렌드.
const ACCENT = "var(--accent)";
const ON_ACCENT = "var(--accent-foreground)";

function pct(rate: number) {
  return Math.round(rate * 100);
}

function fmtPeriod(start: string, end: string) {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return `${sm}.${sd} - ${em}.${ed}`;
}

function fmtDay(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

// 라이트=컬러 로고, 다크=화이트 로고로 스왑(방송 그래픽의 단색 로고 룩).
function TeamLogo({ team, size }: { team: ReportTeamRef | null; size: number }) {
  const box: CSSProperties = { height: size, width: size, flexShrink: 0 };
  if (!team?.logoUrl) {
    return <span style={{ ...box, display: "grid", placeItems: "center", background: FILL, fontFamily: DISPLAY, fontSize: size * 0.4, color: MUTED }}>{team?.shortName?.slice(0, 1) ?? "?"}</span>;
  }
  const useWhite = Boolean(team.useWhiteLogoOnDark && team.logoWhiteUrl);
  return (
    <>
      <img src={team.logoUrl} alt={team.name} className={useWhite ? "dark:hidden" : undefined} style={{ ...box, objectFit: "contain" }} />
      {useWhite ? <img src={team.logoWhiteUrl!} alt={team.name} className="hidden dark:block" style={{ ...box, objectFit: "contain" }} /> : null}
    </>
  );
}

function WinnerLogo({ team, size }: { team: ReportTeamRef | null; size: number }) {
  const box: CSSProperties = { height: size, width: size, flexShrink: 0 };
  if (team?.logoWhiteUrl) {
    return <img src={team.logoWhiteUrl} alt="" aria-hidden style={{ ...box, objectFit: "contain" }} />;
  }
  if (team?.logoUrl) {
    return <img src={team.logoUrl} alt="" aria-hidden style={{ ...box, objectFit: "contain", filter: "brightness(0) invert(1)" }} />;
  }
  if (!team) {
    return <span style={{ ...box, display: "grid", placeItems: "center", color: "#fff", fontFamily: DISPLAY, fontSize: size * 0.42 }}>?</span>;
  }
  return <span style={{ ...box, display: "grid", placeItems: "center", color: "#fff", fontFamily: DISPLAY, fontSize: size * 0.42 }}>{team.shortName.slice(0, 1)}</span>;
}

function ChampImg({ champion, size }: { champion: ReportChampionStat | undefined; size: number }) {
  if (!champion) return null;
  const box: CSSProperties = { height: size, width: size, flexShrink: 0, objectFit: "cover", border: `1px solid ${LINE}` };
  return champion.imageUrl ? (
    <img src={champion.imageUrl} alt={champion.name} style={box} />
  ) : (
    <span style={{ ...box, display: "grid", placeItems: "center", background: FILL, fontFamily: DISPLAY, fontSize: 13, color: MUTED }}>{champion.name.slice(0, 2)}</span>
  );
}

function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionNumber}>
        {n}
      </span>
      <div className={styles.sectionTitleGroup}>
        <h2>{title}</h2>
      </div>
      <span className={styles.sectionScribble} aria-hidden>〰</span>
    </div>
  );
}

export function WeeklyReportView({ report, index }: { report: WeeklyReportRow; index: WeeklyReportSummary[] }) {
  const content = report.content;
  const { stats, review, meta, preview } = content;
  const bySlug = new Map(stats.champions.map((c) => [c.slug, c]));
  const patchLabel = stats.patches.join(", ") || "-";
  const generatedAt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "short" }).format(new Date(report.generated_at));
  const sourceSummary = meta.sources?.length ? `검증 출처 ${meta.sources.length}곳` : "MINION 경기·통계 데이터";
  const banChamp = meta.banSpotlight ? bySlug.get(meta.banSpotlight.championSlug) : undefined;
  const presenceTop = [...stats.champions].sort((a, b) => b.presenceRate - a.presenceRate).slice(0, 5);
  const TIER_ROWS = [
    { key: "sTier", label: "S" },
    { key: "aTier", label: "A" },
    { key: "bTier", label: "B" },
  ] as const;
  const tierBadgeTone: Record<string, CSSProperties> = {
    S: { background: ACCENT, color: ON_ACCENT },
    A: { background: INK, color: SURFACE },
    B: { background: FILL, color: MUTED },
  };

  return (
    <div className={`${styles.report} layout-wide`} style={{ paddingBottom: 120 }}>
      {/* 히어로 */}
      <header className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroMeta}>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", fontVariantNumeric: "tabular-nums", color: MUTED }}>{fmtPeriod(report.period_start, report.period_end)} · LCK · 패치 {patchLabel}</span>
            {index.length > 1 && (
              <nav className={styles.weekNav} aria-label="주차별 리포트">
                {index.map((item) => {
                  const active = item.week_key === report.week_key;
                  return (
                    <Link
                      key={item.week_key}
                      href={`/reports/${item.week_key}`}
                      style={{ display: "inline-block", transform: SKEW, borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: 500, fontVariantNumeric: "tabular-nums", background: active ? ACCENT : FILL, color: active ? ON_ACCENT : MUTED }}
                    >
                      <span style={UNSKEW}>W{item.week_key.split("-W")[1] ?? item.week_key}</span>
                    </Link>
                  );
                })}
              </nav>
            )}
          </div>
          <h1 className={styles.heroTitle}>{content.headline}</h1>
          <p className={styles.heroSubtitle}>{content.subtitle}</p>
          <div className={styles.trustNote}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: "0.16em", textTransform: "uppercase", color: FAINT }}>
              리포트 안내
            </p>
            <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, lineHeight: 1.7, color: MUTED }}>
              AI 생성 리포트 · {generatedAt}{report.model ? ` · ${report.model}` : ""} · {sourceSummary}. 예측과 해석은 참고용입니다.
            </p>
          </div>
          <div className={styles.heroCharacter} aria-hidden>
            <Image src={markerBuddy} alt="" priority sizes="(max-width: 767px) 120px, 226px" />
          </div>
          <div className={styles.statTickets}>
            {[
              { label: "경기", value: String(stats.matchCount) },
              { label: "세트", value: String(stats.setCount) },
              { label: "평균 시간", value: stats.avgGameMinutes ? `${stats.avgGameMinutes}분` : "-" },
              { label: "패치", value: patchLabel },
            ].map((s, i) => (
              <div key={s.label} className={styles.statTicket} style={{ transform: SKEW, minWidth: 128, padding: "14px 22px", background: "transparent" }}>
                <div style={UNSKEW}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: FAINT }}>{s.label}</p>
                  <p style={{ margin: "6px 0 0", fontFamily: DISPLAY, fontSize: 29, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: i === 0 ? ACCENT : INK }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* 01 브리핑 */}
      <section className={styles.reportSection}>
        <SectionHead n="01" title="위클리 브리핑" />
        <div className={styles.briefingBuddy} aria-hidden>
          <Image src={megaphoneBuddy} alt="" sizes="112px" />
        </div>
        <div className={`${styles.notesGrid} grid grid-cols-1`} style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 260px), 1fr))` }}>
          {content.overview.map((text, i) => (
            <div key={i} className={styles.noteCard} style={{ background: SURFACE, padding: 28 }}>
              <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 40, lineHeight: 1, color: GHOST }}>{String(i + 1).padStart(2, "0")}</p>
              <p style={{ margin: "16px 0 0", fontSize: 15.5, fontWeight: 500, lineHeight: 1.8, color: BODY }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 02 결과 & 순위 */}
      <section className={styles.reportSection}>
        <SectionHead n="02" title="이번 주 결과" />
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
          {stats.matches.map((match) => {
            const aWin = match.winnerSlug != null && match.winnerSlug === match.teamA?.slug;
            const bWin = match.winnerSlug != null && match.winnerSlug === match.teamB?.slug;
            const decided = aWin || bWin;
            const winner = aWin ? match.teamA : bWin ? match.teamB : null;
            const winTag: CSSProperties = { display: "inline-block", marginTop: 4, fontSize: 13, fontWeight: 700, color: decided ? "#ffffff" : ACCENT };
            const loseTag: CSSProperties = { ...winTag, color: decided ? "rgb(255 255 255 / 0.58)" : DIM };
            return (
              <article
                key={match.matchId}
                className={`${styles.matchCard} ${winner ? styles.matchCardDecided : ""}`}
                style={{
                  background: winner ? `linear-gradient(rgb(0 0 0 / 0.22), rgb(0 0 0 / 0.22)), ${winner.color}` : SURFACE,
                  border: `1px solid ${winner ? winner.color : LINE}`,
                }}
              >
                <div className={`${styles.resultTeam} ${aWin ? styles.resultWinner : decided ? styles.resultLoser : ""}`}>
                  {winner ? <WinnerLogo team={match.teamA} size={34} /> : <TeamLogo team={match.teamA} size={34} />}
                  <div style={{ minWidth: 0 }}>
                    <b style={{ display: "block", fontFamily: DISPLAY, fontSize: 16, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.teamA?.shortName ?? "TBD"}</b>
                    {decided && <span style={aWin ? winTag : loseTag}>{aWin ? "승리" : "패배"}</span>}
                  </div>
                </div>
                <div className={`${styles.resultScore} ${winner ? styles.resultScoreDecided : ""}`}>
                  <b style={{ fontFamily: DISPLAY, fontSize: 21, lineHeight: 1, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{match.scoreA} : {match.scoreB}</b>
                  <span>{fmtDay(match.date)}</span>
                </div>
                <div className={`${styles.resultTeam} ${styles.resultTeamRight} ${bWin ? styles.resultWinner : decided ? styles.resultLoser : ""}`}>
                  <div style={{ minWidth: 0, textAlign: "right" }}>
                    <b style={{ display: "block", fontFamily: DISPLAY, fontSize: 16, letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.teamB?.shortName ?? "TBD"}</b>
                    {decided && <span style={bWin ? winTag : loseTag}>{bWin ? "승리" : "패배"}</span>}
                  </div>
                  {winner ? <WinnerLogo team={match.teamB} size={34} /> : <TeamLogo team={match.teamB} size={34} />}
                </div>
              </article>
            );
          })}
        </div>

        {/* 주간 팀 성적 */}
        {stats.teamWeekly.length > 0 && (
          <div className={styles.notebookPanel} style={{ marginTop: 48 }}>
            <h3 style={{ margin: "0 0 20px", display: "flex", alignItems: "center", gap: 10, fontFamily: DISPLAY, fontSize: 19, letterSpacing: "0.04em", color: INK }}>
              주간 팀 성적
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: "10px 40px" }}>
              {stats.teamWeekly.map((row, i) => {
                const total = row.setWins + row.setLosses;
                const blocks = total > 0 ? Array.from({ length: total }, (_, k) => k < row.setWins) : [null];
                return (
                  <div key={row.team.slug} style={{ display: "grid", gridTemplateColumns: "30px 30px 56px 1fr 58px", gap: 12, alignItems: "center" }}>
                    <b style={{ fontFamily: DISPLAY, fontSize: 17, fontVariantNumeric: "tabular-nums", color: i < 3 ? ACCENT : DIM }}>{String(i + 1).padStart(2, "0")}</b>
                    <TeamLogo team={row.team} size={26} />
                    <b style={{ fontFamily: DISPLAY, fontSize: 15, letterSpacing: "0.02em", color: INK }}>{row.team.shortName}</b>
                    <span style={{ display: "flex", gap: 4 }}>
                      {blocks.map((won, k) => (
                        <span key={k} style={{ display: "inline-block", width: 16, height: 14, transform: SKEW, background: won ? row.team.color : FILL }} />
                      ))}
                    </span>
                    <span style={{ textAlign: "right", fontSize: 13, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: MUTED, whiteSpace: "nowrap" }}>{row.wins}승 {row.losses}패</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 03 스포트라이트 */}
      <section className={styles.reportSection}>
        <SectionHead n="03" title="위클리 스포트라이트" />
        {review.teamOfWeek.team && (
          <article className={`${styles.teamSpotlight} grid grid-cols-1 sm:grid-cols-[260px_1fr]`} style={{ alignItems: "stretch", background: SURFACE, border: `1px solid ${LINE}`, overflow: "hidden" }}>
            <div style={{ display: "grid", placeItems: "center", background: review.teamOfWeek.team.color, padding: "36px 24px" }}>
              <TeamLogoBig team={review.teamOfWeek.team} />
            </div>
            <div style={{ padding: "36px 40px", minWidth: 0 }}>
              <Image src={flagBuddy} alt="" className={styles.spotlightBuddy} aria-hidden sizes="104px" />
              <span style={{ display: "inline-block", transform: SKEW, borderRadius: 999, background: review.teamOfWeek.team.color, color: "#0c0d0f", padding: "5px 14px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                <span style={UNSKEW}>이 주의 팀</span>
              </span>
              <h3 style={{ margin: "18px 0 0", fontFamily: DISPLAY, fontSize: "clamp(30px, 5vw, 40px)", lineHeight: 1.1, color: INK }}>{review.teamOfWeek.team.name}</h3>
              <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 800, letterSpacing: "0.04em", fontVariantNumeric: "tabular-nums", color: review.teamOfWeek.team.color }}>{review.teamOfWeek.title}</p>
              <p style={{ margin: "16px 0 0", maxWidth: 640, fontSize: 15.5, fontWeight: 500, lineHeight: 1.8, color: BODY }}>{review.teamOfWeek.body}</p>
            </div>
          </article>
        )}
        {review.playersOfWeek.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ marginTop: 12, gap: 12 }}>
            {review.playersOfWeek.map((player) => (
              <article key={player.playerName} className={styles.playerCard} style={{ position: "relative", overflow: "hidden", background: SURFACE, border: `1px solid ${LINE}`, padding: "26px 28px" }}>
                {POSITION_ICON[player.position] && (
                  <img aria-hidden alt="" src={`/objectives/${POSITION_ICON[player.position]}.svg`} style={{ position: "absolute", top: -14, right: -14, width: 116, height: 116, opacity: 0.1, userSelect: "none", pointerEvents: "none" }} />
                )}
                <div style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {player.playerImageUrl ? (
                      <img src={player.playerImageUrl} alt={player.playerName} style={{ height: 52, width: 52, flexShrink: 0, objectFit: "cover", objectPosition: "top", background: FILL, border: `1px solid ${LINE}` }} />
                    ) : (
                      <span style={{ display: "grid", height: 52, width: 52, placeItems: "center", background: FILL, border: `1px solid ${LINE}`, fontFamily: DISPLAY, fontSize: 16, color: MUTED, flexShrink: 0 }}>{player.playerName.slice(0, 2)}</span>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <b style={{ display: "block", fontFamily: DISPLAY, fontSize: 23, color: INK }}>
                        {player.playerSlug ? <Link href={`/players/${player.playerSlug}`} className="hover:underline">{player.playerName}</Link> : player.playerName}
                      </b>
                      <span style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: "0.06em", color: player.team?.color ?? MUTED }}>{player.team?.shortName ?? ""} · {POSITION_LABELS[player.position] ?? player.position}</span>
                    </div>
                  </div>
                  {player.championNames.length > 0 && (
                    <div style={{ margin: "16px 0 0", display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {player.championNames.map((ch) => (
                        <span key={ch} style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: "0.04em", color: MUTED, background: FILL, padding: "3px 9px" }}>{ch}</span>
                      ))}
                    </div>
                  )}
                  <p style={{ margin: "14px 0 0", fontSize: 14.5, fontWeight: 500, lineHeight: 1.75, color: BODY }}>{player.body}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 04 메타 */}
      <section className={styles.reportSection}>
        <SectionHead n="04" title="이번 주 메타" />
        <div style={{ maxWidth: 820, display: "flex", flexDirection: "column", gap: 16, fontSize: 16, fontWeight: 500, lineHeight: 1.85, color: BODY }}>
          {meta.summary.map((para, i) => (
            <p key={i} style={{ margin: 0 }}>{para}</p>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[7fr_5fr]" style={{ marginTop: 40, gap: 12, alignItems: "stretch" }}>
          {/* 밴픽률 차트 */}
          <article className={styles.dataCard} style={{ background: SURFACE, border: `1px solid ${LINE}`, padding: "28px 32px" }}>
            <h3 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 19, letterSpacing: "0.04em", color: INK }}>밴픽률 상위 5</h3>
            <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
              {presenceTop.map((champ, i) => (
                <div key={champ.slug} style={{ display: "grid", gridTemplateColumns: "48px 1fr 84px", gap: 16, alignItems: "center" }}>
                  <ChampImg champion={champ} size={48} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
                      <b style={{ fontSize: 15, fontWeight: 900, color: INK, whiteSpace: "nowrap" }}>{champ.name}</b>
                      <span style={{ fontSize: 12, fontWeight: 500, fontVariantNumeric: "tabular-nums", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>픽 {champ.picks} · 밴 {champ.bans} · 승률 {pct(champ.winRate)}%</span>
                    </div>
                    <div style={{ marginTop: 8, height: 12, background: FILL, transform: SKEW }}>
                      <span style={{ display: "block", height: "100%", background: i === 0 ? ACCENT : DIM, width: `${Math.min(100, pct(champ.presenceRate))}%` }} />
                    </div>
                  </div>
                  <b style={{ textAlign: "right", fontFamily: DISPLAY, fontSize: 27, fontVariantNumeric: "tabular-nums", color: i === 0 ? ACCENT : INK }}>{pct(champ.presenceRate)}%</b>
                </div>
              ))}
            </div>
          </article>

          {/* 밴 타깃 */}
          {meta.banSpotlight && banChamp && (
            <article className={styles.banCard} style={{ position: "relative", overflow: "hidden", background: SURFACE, border: `1px solid color-mix(in srgb, ${REPORT_POINT} 42%, ${LINE})`, padding: "28px 32px", display: "flex", flexDirection: "column" }}>
              <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: `repeating-linear-gradient(-45deg, ${REPORT_POINT} 0 10px, transparent 10px 20px)` }} />
              <span style={{ alignSelf: "flex-start", display: "inline-block", transform: SKEW, borderRadius: 999, background: REPORT_POINT, color: "#0c0d0f", padding: "5px 14px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", marginTop: 10 }}>
                <span style={UNSKEW}>집중 밴</span>
              </span>
              <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ position: "relative", flexShrink: 0 }}>
                  {banChamp.imageUrl && <img src={banChamp.imageUrl} alt={banChamp.name} style={{ height: 88, width: 88, objectFit: "cover", border: `1px solid color-mix(in srgb, ${REPORT_POINT} 42%, ${LINE})` }} />}
                  <span style={{ position: "absolute", inset: 0, boxShadow: `inset 0 0 0 2px ${REPORT_POINT}`, opacity: 0.55 }} />
                </div>
                <div>
                  <b style={{ display: "block", fontFamily: DISPLAY, fontSize: 32, lineHeight: 1.1, color: INK }}>{banChamp.name}</b>
                  <span style={{ display: "inline-block", marginTop: 8, fontSize: 13, fontWeight: 900, fontVariantNumeric: "tabular-nums", letterSpacing: "0.06em", color: ACCENT }}>밴 {banChamp.bans}회 · 밴픽률 {pct(banChamp.presenceRate)}%</span>
                </div>
              </div>
              <p style={{ margin: "20px 0 0", fontSize: 14.5, fontWeight: 500, lineHeight: 1.75, color: BODY }}>{meta.banSpotlight.comment}</p>
            </article>
          )}
        </div>

        {/* 티어 보드 */}
        <div style={{ marginTop: 48 }}>
          <h3 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 19, letterSpacing: "0.04em", color: INK }}>포지션 티어 보드</h3>
          {/* 산식 범례 — 코멘트에 등장하는 스탯 점수의 정의를 보드 진입 전에 제시한다. */}
          <p style={{ margin: "8px 0 20px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.7, color: MUTED }}>
            종합 점수(0-100) = 밴픽률 30% + 보정승률 40% + 스탯 점수 30% · <b style={{ fontWeight: 800, color: BODY }}>스탯 점수</b>는 KDA와 15분 골드 차이를 0-100으로 정규화한 경기 지표다. 챔피언에 마우스를 올리면 세부 수치가 보인다.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {meta.positions.map((pos) => {
              const rising = pos.rising ? bySlug.get(pos.rising) : undefined;
              const rows = TIER_ROWS.filter((t) => pos[t.key].length > 0);
              if (rows.length === 0 && !pos.comment) return null;
              return (
                <article key={pos.position} className={`${styles.tierCard} ${pos.comment ? "grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]" : "grid grid-cols-1"}`} style={{ background: SURFACE, border: `1px solid ${LINE}`, alignItems: "stretch" }}>
                  {/* 좌: 챔피언 티어 — 레퍼런스처럼 박스 없는 클린 리스트. 기울어진 배지가 유일한 도형 액센트. */}
                  <div style={{ padding: "20px 24px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <b style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: "0.06em", color: INK }}>{pos.position}</b>
                      <span style={{ fontSize: 12, fontWeight: 500, color: FAINT }}>{POSITION_LABELS[pos.position]}</span>
                      {rising && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500, letterSpacing: "0.04em", color: ACCENT, whiteSpace: "nowrap" }}>▲ 라이징 {rising.name}</span>}
                    </div>
                    {rows.map((tier) => (
                      // 배지 높이 36px = 칩 높이(이미지 26 + 패딩 8 + 보더 2)와 동일
                      <div key={tier.key} style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 8, alignItems: "start" }}>
                        <span style={{ display: "inline-grid", placeItems: "center", transform: SKEW, width: 40, height: 36, borderRadius: 999, fontFamily: DISPLAY, fontSize: 14, lineHeight: 1, ...tierBadgeTone[tier.label] }}>
                          <span style={UNSKEW}>{tier.label}</span>
                        </span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 10px", alignItems: "center" }}>
                          {pos[tier.key].map((slug) => {
                            const c = bySlug.get(slug);
                            if (!c) return null;
                            const breakdown = `밴픽률 ${pct(c.presenceRate)}% (픽 ${c.picks}·밴 ${c.bans}) · 승률 ${pct(c.winRate)}%${c.statScore != null ? ` · 스탯 ${c.statScore}점` : ""}${c.score != null ? ` → 종합 ${c.score}점` : ""}`;
                            const strong = c.score != null && c.score >= 75;
                            return (
                              // 배지와 같은 평행사변형 칩 — 기울어진 컨테이너 안에서 콘텐츠는 수평 유지.
                              <span key={slug} title={breakdown} style={{ display: "inline-flex", transform: SKEW, borderRadius: 999, border: `1px solid ${strong ? `color-mix(in srgb, ${ACCENT} 45%, ${LINE})` : LINE}`, background: strong ? `color-mix(in srgb, ${ACCENT} 8%, ${SURFACE})` : SURFACE, padding: "4px 14px", cursor: "default" }}>
                                <span style={{ ...UNSKEW, display: "inline-flex", alignItems: "center", gap: 8 }}>
                                  <ChampImg champion={c} size={26} />
                                  <b style={{ fontSize: 12.5, fontWeight: 900, color: INK, whiteSpace: "nowrap" }}>{c.name}</b>
                                  <b style={{ fontFamily: DISPLAY, fontSize: 14, fontVariantNumeric: "tabular-nums", color: strong ? ACCENT : MUTED }}>{c.score != null ? c.score : `${pct(c.winRate)}%`}</b>
                                </span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* 우: 애널리스트 노트 — 같은 카드의 주석 패널로 묶는다(라벨 + 은은한 배경). */}
                  {pos.comment && (
                    <div className="border-t lg:border-t-0 lg:border-l" style={{ borderColor: LINE, background: `color-mix(in srgb, ${FILL} 45%, ${SURFACE})`, padding: "18px 24px 22px" }}>
                      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase", color: FAINT }}>
                        <span aria-hidden style={{ display: "inline-block", width: 8, height: 8, transform: SKEW, background: ACCENT }} />
                        {pos.position} · 분석 노트
                      </p>
                      <p style={{ margin: "10px 0 0", fontSize: 13.5, fontWeight: 500, lineHeight: 1.8, color: BODY }}>{pos.comment}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {(meta.sources?.length ?? 0) > 0 && (
            <p style={{ margin: "24px 0 0", fontSize: 12, fontWeight: 500, color: FAINT }}>
              참고 {meta.sources!.map((s, i) => (<span key={s.url}>{i > 0 && ", "}<a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--ui-ink)]">{s.title}</a></span>))}
            </p>
          )}
        </div>
      </section>

      {/* 05 기록 */}
      <section className={styles.reportSection}>
        <SectionHead n="05" title="이번 주 기록" />
        <div className={styles.recordPosterGrid}>
          {stats.statLeaders.map((leader, index) => (
            <article key={leader.key} className={styles.recordPoster} style={{ "--record-team": leader.team?.color ?? ACCENT } as CSSProperties}>
              <div className={styles.recordPosterHeader}>
                <p>{leader.label}</p>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className={styles.recordPosterMetric}>
                <strong style={{ fontFamily: DISPLAY }}>{leader.value}</strong>
                <span>{leader.unit}</span>
              </div>
              <div className={styles.recordPosterPlayer}>
                <div className={styles.recordPosterPortrait}>
                  {leader.playerImageUrl ? <img src={leader.playerImageUrl} alt={leader.playerName} /> : <span style={{ fontFamily: DISPLAY }}>{leader.playerName.slice(0, 2)}</span>}
                </div>
                <div className={styles.recordPosterBio}>
                <b>
                  {leader.playerSlug ? <Link href={`/players/${leader.playerSlug}`} className="hover:underline">{leader.playerName}</Link> : leader.playerName}
                </b>
                <span style={{ color: leader.team?.color ?? MUTED }}>
                  {leader.team && <TeamLogo team={leader.team} size={16} />}
                  {leader.team?.shortName ?? ""} · {POSITION_LABELS[leader.position] ?? leader.position}
                </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 06 프리뷰 */}
      <section className={styles.reportSection}>
        <SectionHead n="06" title="다음 주 프리뷰" />
        <p style={{ margin: 0, maxWidth: 820, fontSize: 16, fontWeight: 500, lineHeight: 1.85, color: BODY }}>{preview.intro}</p>
        {preview.matches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ marginTop: 32, gap: 12 }}>
            {preview.matches.map((pm) => {
              const aPick = pm.pickTeamSlug === pm.teamA?.slug;
              const picked = aPick ? pm.teamA : pm.teamB;
              const pickColor = picked?.color ?? "var(--ui-border)";
              return (
                <article
                  key={pm.matchId}
                  className={styles.previewCard}
                  style={{
                    ["--preview-pick-color" as string]: pickColor,
                    position: "relative",
                    overflow: "hidden",
                    background: SURFACE,
                    border: `1px solid color-mix(in srgb, ${pickColor} 18%, ${LINE})`,
                  }}
                >
                  <header className={styles.previewHeader}>
                    <span>{fmtDay(pm.date)}{pm.bestOf ? ` · BO${pm.bestOf}` : ""}</span>
                    <strong>AI 선택 {pm.confidence}%</strong>
                  </header>
                  <div className={styles.previewMatchup}>
                    <div className={`${styles.previewTeam} ${aPick ? styles.previewTeamPicked : ""}`}>
                      <TeamLogo team={pm.teamA} size={46} />
                      <b>{pm.teamA?.shortName ?? "TBD"}</b>
                    </div>
                    <span className={styles.previewVs}>VS</span>
                    <div className={`${styles.previewTeam} ${!aPick ? styles.previewTeamPicked : ""}`}>
                      <TeamLogo team={pm.teamB} size={46} />
                      <b>{pm.teamB?.shortName ?? "TBD"}</b>
                    </div>
                  </div>
                  <div className={styles.previewAnalysis}>
                    <h3>{picked?.shortName} 승리 예상</h3>
                    <p>{pm.reasoning}</p>
                    <div className={styles.previewKeyPoint}>
                      <b>관전 포인트</b>
                      <span>{pm.keyPoint}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p style={{ marginTop: 24, background: FILL, padding: "24px 20px", fontSize: 14, fontWeight: 700, color: MUTED }}>다음 주 일정은 아직 확정되지 않았다. 대진이 잡히면 AI 픽과 함께 이 자리에 추가된다.</p>
        )}

        <div className={styles.reportFooter} style={{ marginTop: 56, borderTop: `1px solid ${LINE}`, paddingTop: 18, display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: FAINT }}>* AI 분석실의 예측은 경기 데이터 기반의 참고용 콘텐츠다. 결과는 무대 위 선수들이 만든다.</p>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: FAINT }}>MINION AI 분석실 · {generatedAt} 발행{report.model ? ` · ${report.model}` : ""} · 모든 통계는 LCK 경기 기록 집계 기준</p>
        </div>
      </section>
    </div>
  );
}

// TOW 컬러 블록 안의 큰 로고(다크=화이트 로고, 라이트=컬러 로고).
function TeamLogoBig({ team }: { team: ReportTeamRef }) {
  const box: CSSProperties = { height: 128, width: 128, objectFit: "contain", filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.4))" };
  const useWhite = Boolean(team.useWhiteLogoOnDark && team.logoWhiteUrl);
  if (!team.logoUrl) return null;
  return (
    <>
      <img src={team.logoUrl} alt={team.name} className={useWhite ? "dark:hidden" : undefined} style={box} />
      {useWhite ? <img src={team.logoWhiteUrl!} alt={team.name} className="hidden dark:block" style={box} /> : null}
    </>
  );
}
