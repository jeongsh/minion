// 인증/출석 액션의 상태 타입·초기값.
// "use server" 파일(actions.ts)은 async 함수만 export할 수 있으므로
// 객체/상수는 이 일반 모듈로 분리한다.

export type AuthActionState = {
  error: string | null;
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
