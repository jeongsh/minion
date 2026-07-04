export { displayNameFromLeaguepediaPage } from "./leaguepedia-identity.ts";

import { leaguepediaSourceId } from "./leaguepedia-identity.ts";

export function leaguepediaSourcePlayerId(pageName: string) {
  return leaguepediaSourceId(pageName);
}
