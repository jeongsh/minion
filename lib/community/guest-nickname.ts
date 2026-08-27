const MINION_PREFIXES = [
  "꾸벅조는", "총총걷는", "뒤뚱대는", "간식찾는", "몰래쉬는", "딴짓하는", "눈치보는", "춤추는",
  "신난", "삐진", "겁먹은", "배고픈", "멍때리는", "수풀숨은", "강구경온", "바론구경온",
  "길을잃은", "집에가고픈", "무리놓친", "늦잠잔", "혼자남은", "뒤처진", "한대남은", "귀환못한",
  "퇴근못한", "살고싶은", "정글에버려진", "미드에서헤맨", "집앞까지온", "넥서스처음본", "마지막까지남은", "아무도안잡는",
  "막타훔친", "막타버틴", "CS다먹은", "귀환끊은", "길막하는", "어그로끈", "라인밀어버린", "라인얼려버린",
  "경험치먹는", "킬먹고간", "펜타뺏은", "점멸뺀", "스킬피한", "논타겟막은", "그랩막아선", "승급전망친",
  "바론버프받은", "장로버프받은", "용막타친", "바론막타친", "정글마실간", "탑끝까지민", "미드달리는", "백도어하는",
  "다이브한", "포탑치는", "포탑맞는", "억제기앞에선", "넥서스치는", "서렌반대한", "와드인척한", "캐리중인",
] as const;

export function nicknameFromKey(key: string) {
  const normalized = key.replace(/[^a-f0-9]/gi, "").padEnd(10, "0");
  const prefix = MINION_PREFIXES[Number.parseInt(normalized.slice(0, 2), 16) % MINION_PREFIXES.length];
  const suffix = (Number.parseInt(normalized.slice(4, 10), 16) % 10_000).toString().padStart(4, "0");
  return `${prefix}미니언${suffix}`;
}
