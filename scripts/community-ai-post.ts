import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateStudioDraft } from "../lib/community/ai-studio-generator.ts";
import { parseStudioInput, parseStudioWorkspace } from "../lib/community/ai-studio.ts";

function readJson(path: string): unknown {
  const data = readFileSync(resolve(path));
  if (data.byteLength > 100_000) throw new Error("입력 파일은 100KB 이하여야 합니다.");
  return JSON.parse(data.toString("utf8").replace(/^\uFEFF/, ""));
}

function isWorkspace(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "version" in value);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log([
      "AI 캐릭터 글 1개 생성 / 게시",
      "node --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/community-ai-post.ts --input=<설정.json> --output=<새초안.json>",
      "node --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/community-ai-post.ts --publish=<초안.json>",
      "node --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/community-ai-post.ts --provision",
      "생성은 DB에 쓰지 않습니다. --publish는 선택한 AI 전용 작성자로 글 한 건만 공개 등록합니다.",
      "같은 초안 파일을 다시 게시하면 기존 글을 반환합니다. 댓글은 게시하지 않습니다.",
    ].join("\n"));
    return;
  }
  if (args.length === 1 && args[0] === "--provision") {
    const { provisionStudioAuthors, studioGuestKey, studioGuestNickname } = await import("../lib/community/ai-studio-publisher.ts");
    const { STUDIO_PERSONA_AVATARS } = await import("../lib/community/ai-studio-avatars.ts");
    const members = await provisionStudioAuthors({ avatars: STUDIO_PERSONA_AVATARS });
    console.log(JSON.stringify({ members, guest: { personaId: "unaffiliated-baiter", name: studioGuestNickname(studioGuestKey()), authorId: null }, postsCreated: 0 }, null, 2));
    return;
  }
  const options = new Map<string, string>();
  for (const arg of args) {
    const match = /^--(input|output|publish)=(.+)$/.exec(arg);
    if (!match || options.has(match[1])) throw new Error("명령 옵션을 확인해 주세요. --help로 사용법을 볼 수 있습니다.");
    options.set(match[1], match[2]);
  }

  const publishPath = options.get("publish");
  if (publishPath) {
    if (options.size !== 1) throw new Error("--publish는 생성 옵션과 함께 사용할 수 없습니다.");
    const value = readJson(publishPath);
    const draft = isWorkspace(value) ? parseStudioWorkspace(value).draft : value;
    if (!draft) throw new Error("파일에 생성된 초안이 없습니다.");
    const { publishStudioPost } = await import("../lib/community/ai-studio-publisher.ts");
    const result = await publishStudioPost(draft);
    console.log(JSON.stringify({ ...result, path: `/community/post/${result.postId}` }, null, 2));
    return;
  }

  const inputPath = options.get("input");
  const outputPath = options.get("output");
  if (!inputPath || !outputPath || options.size !== 2) throw new Error("생성에는 --input과 --output이 필요합니다.");
  if (existsSync(resolve(outputPath))) throw new Error("출력 파일이 이미 있습니다. 새 파일명을 지정해 주세요.");
  const value = readJson(inputPath);
  const input = isWorkspace(value) ? parseStudioWorkspace(value).input : parseStudioInput(value);
  const draft = await generateStudioDraft(input);
  writeFileSync(resolve(outputPath), JSON.stringify({ version: 1, input, draft }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ saved: resolve(outputPath), model: draft.model, author: draft.post.personaId, title: draft.post.title, content: draft.post.content, reviewNotes: draft.reviewNotes }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "AI 글 작업에 실패했습니다.");
  process.exitCode = 1;
});
