export const COMMENT_DESKTOP_MAX_LENGTH = 400;
export const COMMENT_MOBILE_MAX_LENGTH = 200;
export const POST_TITLE_MAX_LENGTH = 100;
export const POST_TEXT_MAX_LENGTH = 60_000;
export const POST_SERIALIZED_MAX_LENGTH = 1_000_000;

export function isMobileCommentClient(
  userAgent: string | null | undefined,
  clientHintMobile?: string | null,
): boolean {
  if (clientHintMobile === "?1") return true;
  return /Android|iPhone|iPad|iPod|IEMobile|Mobile/i.test(userAgent ?? "");
}

export function getCommentMaxLengthForRequest(
  userAgent: string | null | undefined,
  clientHintMobile?: string | null,
): number {
  return isMobileCommentClient(userAgent, clientHintMobile)
    ? COMMENT_MOBILE_MAX_LENGTH
    : COMMENT_DESKTOP_MAX_LENGTH;
}

export function getCommunityPostTextLength(content: string): number {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    return content.length;
  }
  if (!doc || typeof doc !== "object") return content.length;

  let length = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.type === "text" && typeof record.text === "string") {
      length += record.text.length;
    }
    if (Array.isArray(record.content)) record.content.forEach(walk);
  };
  walk(doc);
  return length;
}
