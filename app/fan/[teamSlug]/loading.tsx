import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { FanHomeLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><FanHomeLoadingSkeleton /><NavigationLoadingOverlay label="팬페이지를 불러오는 중입니다" /></>;
}
