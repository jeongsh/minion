"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Crown,
  House,
  Menu,
  MessageCircle,
  Search,
  Shield,
  Trophy,
  UsersRound,
} from "lucide-react";
import styles from "./concept.module.css";
import "./overlay.css";

const mainMenu = [
  { label: "홈", icon: House },
  { label: "일정", icon: CalendarDays },
  { label: "순위", icon: Crown },
  { label: "대회", icon: Trophy },
  { label: "팀", icon: Shield },
  { label: "선수", icon: UsersRound },
  { label: "커뮤니티", icon: MessageCircle },
];

const teams = [
  ["T1", "T1", "#e64b4b"],
  ["GEN", "Gen.G", "#d89c28"],
  ["HLE", "Hanwha Life Esports", "#ef7c22"],
  ["DK", "Dplus KIA", "#37aab8"],
] as const;

const tabs = ["홈", "일정", "선수", "영상", "커뮤니티", "정보"];

const matches = [
  { day: "07.08", event: "MSI 2026", opponent: "Bilibili Gaming", code: "BLG", time: "18:00" },
  { day: "07.10", event: "MSI 2026", opponent: "G2 Esports", code: "G2", time: "21:00" },
  { day: "07.17", event: "LCK 2026", opponent: "Dplus KIA", code: "DK", time: "17:00" },
];

const videos = [
  { label: "MATCH HIGHLIGHT", title: "마지막 한타로 완성한 역전승", meta: "조회수 12만 · 3시간 전", tone: "blue" },
  { label: "TEAM ORIGINAL", title: "선수들이 직접 말하는 경기 비하인드", meta: "조회수 8.4만 · 어제", tone: "violet" },
  { label: "MIC CHECK", title: "결정적인 순간, 팀 보이스 공개", meta: "조회수 21만 · 2일 전", tone: "orange" },
];

const posts = [
  ["경기 끝나고 선수들 인사하는 장면 좋았다", "자유", "24", "방금"],
  ["다음 경기 밴픽은 어떻게 예상함?", "응원", "18", "12분 전"],
  ["오늘 경기 직관 사진 몇 장", "사진", "31", "35분 전"],
  ["이번 주 팀 일정 정리", "정보", "42", "1시간 전"],
];

export function ChzzkConcept() {
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("홈");
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    document.documentElement.removeAttribute("data-navigation-pending");
    document.documentElement.removeAttribute("aria-busy");
  }, []);

  return (
    <div className={styles.app} data-navigation-immediate="true">
      <header className={styles.topbar}>
        <div className={styles.brand}>MINION</div>
        <button className={styles.mobileMenu} aria-label="메뉴 열기"><Menu size={21} /></button>
        <label className={styles.search}>
          <Search size={18} />
          <input aria-label="검색" placeholder="팀, 선수, 대회를 검색해보세요" />
        </label>
        <div className={styles.topActions}>
          <button aria-label="알림"><Bell size={20} /></button>
          <button className={styles.login}><CircleUserRound size={19} /> 로그인</button>
        </div>
      </header>

      <aside className={styles.sidebar}>
        <nav className={styles.primaryNav} aria-label="주요 메뉴">
          {mainMenu.map(({ label, icon: Icon }) => (
            <button key={label} className={label === "홈" ? styles.activeMenu : ""}>
              <Icon size={20} strokeWidth={label === "홈" ? 2.5 : 2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className={styles.sidebarDivider} />
        <section className={styles.teamSection}>
          <button className={styles.teamHeading} onClick={() => setTeamsOpen((value) => !value)}>
            <span>관심 팀</span>
            <ChevronDown size={17} className={teamsOpen ? styles.rotate : ""} />
          </button>
          {teamsOpen && (
            <div className={styles.teamList}>
              {teams.map(([code, name, color], index) => (
                <button key={code} className={index === 0 ? styles.selectedTeam : ""}>
                  <span className={styles.teamAvatar} style={{ background: color }}>{code.slice(0, 2)}</span>
                  <span>{name}</span>
                  {index === 0 && <span className={styles.liveDot}>LIVE</span>}
                </button>
              ))}
            </div>
          )}
          <button className={styles.allTeams}>전체 팀 보기 <ChevronRight size={15} /></button>
        </section>
        <div className={styles.sidebarFoot}>LCK 팬을 위한 새로운 홈</div>
      </aside>

      <main className={styles.main}>
        <section className={styles.channelHeader}>
          <div className={styles.cover}>
            <div className={styles.coverPattern} />
            <div className={styles.coverCopy}>
              <span>2026 SEASON</span>
              <strong>WE MAKE LEGENDS</strong>
            </div>
          </div>
          <div className={styles.profileRow}>
            <div className={styles.profileMark}>T1</div>
            <div className={styles.profileInfo}>
              <div className={styles.nameLine}><h1>T1</h1><span className={styles.verified}>✓</span></div>
              <p>팔로워 32.8만 · LCK</p>
            </div>
            <button className={following ? styles.following : styles.follow} onClick={() => setFollowing((value) => !value)}>
              {following ? "팔로잉" : "+ 팔로우"}
            </button>
          </div>
          <nav className={styles.tabs} aria-label="팀 채널 메뉴">
            {tabs.map((tab) => (
              <button key={tab} className={activeTab === tab ? styles.activeTab : ""} onClick={() => setActiveTab(tab)}>{tab}</button>
            ))}
          </nav>
        </section>

        <div className={styles.content}>
          {activeTab !== "홈" ? (
            <section className={styles.placeholder}>
              <span>{activeTab}</span>
              <h2>T1 {activeTab}</h2>
              <p>채널 탭 전환 구조를 확인하기 위한 목업 화면입니다.</p>
            </section>
          ) : (
            <>
              <section className={styles.liveHero}>
                <div className={styles.liveVisual}>
                  <span className={styles.liveBadge}>LIVE</span>
                  <div className={styles.stageGraphic}><span>T1</span><b>VS</b><span>BLG</span></div>
                </div>
                <div className={styles.liveCopy}>
                  <span className={styles.kicker}>MSI 2026 · BRACKET STAGE</span>
                  <h2>T1 vs Bilibili Gaming</h2>
                  <p>브래킷 스테이지 승자조 2라운드</p>
                  <div className={styles.viewer}><span /> 48,239명 시청 중</div>
                  <button>경기 보러가기</button>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>
                  <div><h2>다가오는 경기</h2><p>팀의 다음 일정을 확인하세요</p></div>
                  <button>전체 일정 <ChevronRight size={16} /></button>
                </div>
                <div className={styles.matchList}>
                  {matches.map((match) => (
                    <article key={match.day + match.code}>
                      <div className={styles.dateBox}><strong>{match.day}</strong><span>{match.time}</span></div>
                      <div className={styles.matchEvent}><span>{match.event}</span><strong>정규 시즌</strong></div>
                      <div className={styles.versus}><span className={styles.miniMark}>T1</span><b>T1</b><em>VS</em><b>{match.opponent}</b><span className={styles.opponentMark}>{match.code}</span></div>
                      <button aria-label="경기 상세"><ChevronRight size={18} /></button>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>
                  <div><h2>최신 영상</h2><p>공식 채널의 새로운 콘텐츠</p></div>
                  <div className={styles.pager}><button><ChevronLeft size={18} /></button><button><ChevronRight size={18} /></button></div>
                </div>
                <div className={styles.videoGrid}>
                  {videos.map((video, index) => (
                    <article key={video.title}>
                      <div className={`${styles.thumbnail} ${styles[video.tone]}`}>
                        <span>{video.label}</span><strong>{index === 0 ? "T1  3 : 2  BLG" : index === 1 ? "BEHIND THE GAME" : "TEAM VOICE"}</strong>
                        <i>{index === 0 ? "12:48" : index === 1 ? "08:21" : "15:02"}</i>
                      </div>
                      <h3>{video.title}</h3><p>{video.meta}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>
                  <div><h2>팬 커뮤니티</h2><p>지금 팬들이 나누는 이야기</p></div>
                  <button>전체 글 <ChevronRight size={16} /></button>
                </div>
                <div className={styles.communityList}>
                  {posts.map(([title, board, comments, time]) => (
                    <article key={title}><span className={styles.boardTag}>{board}</span><strong>{title}</strong><span className={styles.commentCount}>댓글 {comments}</span><time>{time}</time></article>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
