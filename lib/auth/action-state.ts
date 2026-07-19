// 인증/출석 액션의 상태 타입·초기값.
// "use server" 파일(actions.ts)은 async 함수만 export할 수 있으므로
// 객체/상수는 이 일반 모듈로 분리한다.

export type AuthActionState = {
  error: string | null;
  message?: string | null;
};

export const INITIAL_AUTH_STATE: AuthActionState = { error: null };

export type AttendanceState = {
  status: "idle" | "success" | "already" | "error" | "unauthenticated";
  message: string | null;
};

export const INITIAL_ATTENDANCE_STATE: AttendanceState = {
  status: "idle",
  message: null,
};

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

export const INITIAL_PROFILE_STATE: ProfileActionState = {
  status: "idle",
  message: null,
};

// 비밀번호 변경 / 회원 탈퇴는 성공 시 각각 폼 리셋·리다이렉트만 하면 되므로
// 프로필과 같은 status/message 형태를 재사용한다.
export type PasswordActionState = ProfileActionState;

export const INITIAL_PASSWORD_STATE: PasswordActionState = {
  status: "idle",
  message: null,
};

export type DeleteAccountState = ProfileActionState;

export const INITIAL_DELETE_ACCOUNT_STATE: DeleteAccountState = {
  status: "idle",
  message: null,
};

// 탈퇴 확인 문구. 폼(클라이언트)과 액션(서버)이 같은 값을 봐야 하므로 여기서 단일 정의한다.
export const DELETE_ACCOUNT_CONFIRM_TEXT = "탈퇴합니다";
