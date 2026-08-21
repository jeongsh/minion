import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { PlayersLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><PlayersLoadingSkeleton /><NavigationLoadingOverlay label="선수 목록을 불러오는 중입니다" /></>;
}
