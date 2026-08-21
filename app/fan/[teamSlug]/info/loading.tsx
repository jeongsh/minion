import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { FanInfoLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><FanInfoLoadingSkeleton /><NavigationLoadingOverlay label="팀 정보를 불러오는 중입니다" /></>;
}
