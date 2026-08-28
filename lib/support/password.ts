// 비공개 문의 비밀번호 해시. 새 의존성을 추가하지 않도록 node:crypto의 scrypt를 쓴다.
// 저장 형식: "<salt-hex>:<hash-hex>". node:crypto 자체가 브라우저 번들에서 깨지므로
// "server-only"를 따로 붙이지 않아도 클라이언트에 섞여 들어갈 일이 없고, 덕분에
// 순수 node --test로 바로 검증할 수 있다(다른 lib/**/*.test.ts와 같은 컨벤션).

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashInquiryPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyInquiryPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
