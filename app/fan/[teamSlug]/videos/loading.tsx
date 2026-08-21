import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { FanVideosLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><FanVideosLoadingSkeleton /><NavigationLoadingOverlay label="영상을 불러오는 중입니다" /></>;
}
