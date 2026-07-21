// 클라이언트 컴포넌트가 안전하게 import할 수 있는 값만 둔다.
// 서버 전용 조회는 lib/fan/fan-header.ts 쪽에 있다(그쪽은 admin 클라이언트를 쓴다).

// 헤더 업로드 자격: 해당 팀을 이 기간 이상 팔로우한 로그인 계정. 어드민은 예외.
export const FAN_HEADER_FOLLOW_DAYS = 7;
// 한 유저가 한 팀에 동시에 올려둘 수 있는 후보 수.
export const FAN_HEADER_MAX_CANDIDATES_PER_USER = 3;
// 헤더는 와이드 배너라 지나치게 세로인 이미지는 받지 않는다.
export const FAN_HEADER_MIN_ASPECT = 1.6;
export const FAN_HEADER_MIN_WIDTH = 1200;

export type FanHeaderUploadBlockedReason = "anonymous" | "not-following" | "too-new" | "quota";

export function fanHeaderUploadBlockedMessage(reason: FanHeaderUploadBlockedReason): string {
  switch (reason) {
    case "anonymous":
      return "로그인하면 헤더를 올릴 수 있어요.";
    case "not-following":
      return "이 팀을 팔로우하면 헤더를 올릴 수 있어요.";
    case "too-new":
      return `팔로우 ${FAN_HEADER_FOLLOW_DAYS}일이 지나면 헤더를 올릴 수 있어요.`;
    case "quota":
      return `동시에 등록할 수 있는 헤더는 ${FAN_HEADER_MAX_CANDIDATES_PER_USER}개까지예요.`;
  }
}

export type FanHeaderCandidate = {
  id: string;
  teamId: string;
  userId: string;
  imageUrl: string;
  width: number;
  height: number;
  caption: string | null;
  voteCount: number;
  createdAt: string;
  authorNickname: string | null;
  votedByMe: boolean;
  /** 이번 주 대표 헤더로 적용된 후보인지. */
  isActive: boolean;
};

export type FanHeaderState = {
  /** 이번 주 대표 헤더. 선정 전이거나 후보가 없으면 null. */
  activeImageUrl: string | null;
  weekStart: string;
  candidates: FanHeaderCandidate[];
  canUpload: boolean;
  /** canUpload가 false인 이유. UI에서 안내 문구로 쓴다. */
  uploadBlockedReason: FanHeaderUploadBlockedReason | null;
  /** 어드민은 팔로우 기간과 무관하게 올릴 수 있고, 후보를 즉시 적용할 수 있다. */
  isAdmin: boolean;
};
