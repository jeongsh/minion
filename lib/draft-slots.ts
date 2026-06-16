import type { Player, PlayerStatLine, SetPickBan, SetResult } from "@/lib/types";

export const DRAFT_POSITIONS: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];

export type DraftSlot = {
  side: "blue" | "red";
  actionType: "pick" | "ban";
  slotNumber: number;
  draftOrderIndex: number;
  phase: string;
  teamId: string;
  championId: string;
};

function teamIdForSide(set: SetResult, side: "blue" | "red") {
  return side === "blue" ? set.blueTeamId : set.redTeamId;
}

function teamDraftItems(
  picksBans: SetPickBan[],
  teamId: string,
  actionType: "pick" | "ban",
) {
  return picksBans
    .filter((item) => item.teamId === teamId && item.actionType === actionType)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function lineDisplayChampionId(
  linePick: SetPickBan | null,
  formIndex: number,
  championIds: string[],
) {
  if (formIndex < 0) {
    return "";
  }

  return championIds[formIndex] ?? linePick?.championId ?? "";
}

export function buildDraftSlots({
  set,
  picksBans,
}: {
  set: SetResult;
  picksBans: SetPickBan[];
}): DraftSlot[] {
  return (["blue", "red"] as const).flatMap((side) => {
    const teamId = teamIdForSide(set, side);

    return (["ban", "pick"] as const).flatMap((actionType) => {
      const existing = teamDraftItems(picksBans, teamId, actionType);

      return Array.from({ length: 5 }, (_, index) => {
        const slotNumber = index + 1;
        const item = existing[index];

        return {
          side,
          actionType,
          slotNumber,
          draftOrderIndex: item?.orderIndex ?? slotNumber,
          phase: item?.phase ?? `${actionType}${slotNumber}`,
          teamId: item?.teamId || teamId,
          championId: item?.championId ?? "",
        };
      });
    });
  });
}

export function draftSlotFormIndex(
  slots: DraftSlot[],
  side: "blue" | "red",
  actionType: "pick" | "ban",
  slotNumber: number,
) {
  return slots.findIndex(
    (slot) => slot.side === side && slot.actionType === actionType && slot.slotNumber === slotNumber,
  );
}

export function teamDraftSide({
  teamId,
  teamName,
  picksBans,
  playerStatLines,
  lineup,
}: {
  teamId: string;
  teamName: string;
  picksBans: SetPickBan[];
  playerStatLines: PlayerStatLine[];
  lineup: Array<{ position: Player["position"]; player?: Player }>;
}) {
  const bans = teamDraftItems(picksBans, teamId, "ban");
  const picks = teamDraftItems(picksBans, teamId, "pick");
  const linePicks = DRAFT_POSITIONS.map((position) => {
    const statLine = playerStatLines.find((line) => line.teamId === teamId && line.position === position);
    return (
      picksBans.find(
        (item) =>
          item.actionType === "pick" &&
          item.teamId === teamId &&
          item.championId &&
          item.championId === statLine?.championId,
      ) ?? null
    );
  });

  return {
    teamName,
    teamId,
    bans,
    picks,
    linePicks,
    lineup,
  };
}

export function linePickFormIndex(
  slots: DraftSlot[],
  side: "blue" | "red",
  orderedPicks: SetPickBan[],
  linePick: SetPickBan | null,
) {
  if (!linePick) {
    return -1;
  }

  const slotNumber = orderPickSlotNumber(orderedPicks, linePick, orderedPicks.findIndex((pick) => pick.id === linePick.id));
  return draftSlotFormIndex(slots, side, "pick", slotNumber);
}

export function orderPickSlotNumber(
  picks: SetPickBan[],
  item: SetPickBan | null,
  displayIndex: number,
) {
  if (item) {
    const position = picks.findIndex((pick) => pick.id === item.id);
    if (position >= 0) {
      return position + 1;
    }
  }

  return displayIndex + 1;
}

export function banPickSlotNumber(
  bans: SetPickBan[],
  item: SetPickBan | null,
  displayIndex: number,
) {
  if (item) {
    const position = bans.findIndex((ban) => ban.id === item.id);
    if (position >= 0) {
      return position + 1;
    }
  }

  return displayIndex + 1;
}
