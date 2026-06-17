"use client";

import { useState } from "react";
import type { Player, Team } from "@/lib/types";
import { syncPlayerSocialFromLeaguepediaAction, updatePlayerDetailAction } from "./actions";

const POS_LABEL: Record<string, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "원딜",
  SUP: "서폿",
};

function inputClassName() {
  return "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
}

export function PlayerEditForm({
  player,
  teams,
}: {
  player: Player;
  teams: Team[];
}) {
  const leaguepediaPage = player.leaguepediaPage ?? "";
  const [isStarter, setIsStarter] = useState(player.isStarter ?? false);
  const [previewUrl, setPreviewUrl] = useState(player.profileImageUrl || "");

  return (
    <div className="flex flex-col gap-8">
      {leaguepediaPage ? (
        <form action={syncPlayerSocialFromLeaguepediaAction} className="flex justify-end">
          <input type="hidden" name="id" value={player.id} />
          <input type="hidden" name="slug" value={player.slug} />
          <input type="hidden" name="leaguepedia_page" value={leaguepediaPage} />
          <button
            type="submit"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted"
          >
            Leaguepedia에서 SNS 가져오기
          </button>
        </form>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">프로필 사진</h2>
        <div className="overflow-hidden rounded-md border border-border bg-surface-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={player.name} className="aspect-[4/5] w-full object-cover object-top" />
          ) : (
            <div className="grid aspect-[4/5] place-items-center text-sm text-muted">No image</div>
          )}
        </div>
      </section>

      <form
        action={async (formData) => {
          await updatePlayerDetailAction(formData);
        }}
        className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-6"
      >
        <input type="hidden" name="id" value={player.id} />
        <input type="hidden" name="slug" value={player.slug} />
        <input type="hidden" name="is_starter" value={isStarter ? "true" : "false"} />

        <div>
          <h2 className="text-lg font-semibold">기본 정보</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">선수명 (ID)</span>
              <input name="name" defaultValue={player.name} required className={inputClassName()} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">본명</span>
              <input name="real_name" defaultValue={player.realName ?? ""} className={inputClassName()} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">팀</span>
              <select name="team_id" defaultValue={player.teamId ?? ""} className={inputClassName()}>
                <option value="">— 없음 —</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">포지션</span>
              <select name="position" defaultValue={player.position} className={inputClassName()}>
                {Object.entries(POS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 md:col-span-2">
              <span className="text-sm font-medium">Leaguepedia 페이지 ID</span>
              <input
                name="leaguepedia_page"
                defaultValue={leaguepediaPage}
                placeholder="Lucid (Choi Yong-hyeok)"
                className={inputClassName()}
              />
              <span className="text-xs text-muted">
                리그피디아 API 조회용 식별자입니다. 화면에는 위 선수명만 표시됩니다.
              </span>
            </label>
          </div>

          <label className="mt-4 flex cursor-pointer items-center gap-3">
            <div
              onClick={() => setIsStarter((value) => !value)}
              className={`relative h-6 w-11 rounded-full transition-colors ${isStarter ? "bg-accent" : "bg-border"}`}
            >
              <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${isStarter ? "translate-x-6" : "translate-x-1"}`}
              />
            </div>
            <span className="text-sm font-medium">주전 선수</span>
          </label>
        </div>

        <div>
          <h2 className="text-lg font-semibold">프로필 사진 설정</h2>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">이미지 URL</span>
              <input
                name="profile_image_url"
                defaultValue={player.profileImageUrl ?? ""}
                placeholder="https://..."
                className={inputClassName()}
                onChange={(event) => setPreviewUrl(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">파일 업로드</span>
              <input
                type="file"
                name="profile_image_file"
                accept="image/*"
                className={inputClassName()}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setPreviewUrl(URL.createObjectURL(file));
                }}
              />
              <span className="text-xs text-muted">URL과 파일을 함께 넣으면 파일 업로드가 우선 적용됩니다.</span>
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold">SNS / 방송</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">X (Twitter)</span>
              <input name="twitter_url" defaultValue={player.twitterUrl ?? ""} placeholder="https://x.com/..." className={inputClassName()} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Instagram</span>
              <input name="instagram_url" defaultValue={player.instagramUrl ?? ""} placeholder="https://instagram.com/..." className={inputClassName()} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">YouTube</span>
              <input name="youtube_url" defaultValue={player.youtubeUrl ?? ""} placeholder="https://youtube.com/..." className={inputClassName()} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Facebook</span>
              <input name="facebook_url" defaultValue={player.facebookUrl ?? ""} placeholder="https://facebook.com/..." className={inputClassName()} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Discord</span>
              <input name="discord_url" defaultValue={player.discordUrl ?? ""} placeholder="https://discord.gg/..." className={inputClassName()} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">방송 (Twitch / CHZZK 등)</span>
              <input name="stream_url" defaultValue={player.streamUrl ?? ""} placeholder="https://..." className={inputClassName()} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">비워두면 공개 선수 상세 페이지에 표시되지 않습니다.</p>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background">
            저장
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
