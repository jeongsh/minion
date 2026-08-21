import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { FanPlayersLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><FanPlayersLoadingSkeleton /><NavigationLoadingOverlay label="선수단을 불러오는 중입니다" /></>;
}
