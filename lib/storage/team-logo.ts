import { createHash } from "node:crypto";

import { prepareProfileImage } from "@/lib/images/prepare-profile-image";
import { TEAM_LOGO_MAX_BYTES } from "@/lib/team-logos";
import { uploadToR2 } from "./r2";

export async function prepareTeamLogoFile(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size) return null;
  if (file.size > TEAM_LOGO_MAX_BYTES) throw new Error("로고 파일은 768KB 이하로 올려 주세요.");
  try {
    return await prepareProfileImage(Buffer.from(await file.arrayBuffer()), { allowSvg: true });
  } catch {
    throw new Error("PNG, JPG, WebP 또는 SVG 이미지 파일을 선택해 주세요.");
  }
}

export async function storeTeamLogo(image: Awaited<ReturnType<typeof prepareProfileImage>>) {
  const hash = createHash("sha256").update(image.bytes).digest("hex");
  return uploadToR2("team-logos/" + hash + ".webp", image.bytes, image.contentType, {
    cacheControl: "public, max-age=31536000, immutable",
    signal: AbortSignal.timeout(12_000),
  });
}

export async function storeLeaguepediaTeamLogo(source: string) {
  const url = new URL(source);
  if (
    url.origin !== "https://static.wikia.nocookie.net" || url.username || url.password
    || !url.pathname.startsWith("/lolesports_gamepedia_en/images/")
  ) {
    throw new Error("Unexpected Leaguepedia team logo source.");
  }
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0", referer: "https://lol.fandom.com/", accept: "image/*" },
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok || !response.body || !response.headers.get("content-type")?.startsWith("image/")) {
    throw new Error("Leaguepedia team logo download failed (" + response.status + ").");
  }
  const maxBytes = 4 * 1024 * 1024;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Leaguepedia team logo exceeds 4 MiB.");
    }
    chunks.push(value);
  }
  return storeTeamLogo(await prepareProfileImage(Buffer.concat(chunks), { allowSvg: true }));
}
