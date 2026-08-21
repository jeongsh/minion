import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { FanMatchesLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><FanMatchesLoadingSkeleton /><NavigationLoadingOverlay label="팀 일정을 불러오는 중입니다" /></>;
}
