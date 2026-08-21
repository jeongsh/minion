import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { FanOnionLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><FanOnionLoadingSkeleton /><NavigationLoadingOverlay label="비난양파를 불러오는 중입니다" /></>;
}
