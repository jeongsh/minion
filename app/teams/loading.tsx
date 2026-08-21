import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { TeamsLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><TeamsLoadingSkeleton /><NavigationLoadingOverlay label="팀 정보를 불러오는 중입니다" /></>;
}
