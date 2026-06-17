/** Leaguepedia page ID에서 화면 표시용 닉네임을 추출한다. 예: "Lucid (Choi Yong-hyeok)" → "Lucid" */
export function displayNameFromLeaguepediaPage(pageName: string | null | undefined) {
  return String(pageName ?? "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

export function leaguepediaSourcePlayerId(pageName: string) {
  return `lp:${pageName}`;
}
