import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { FanSocialLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><FanSocialLoadingSkeleton /><NavigationLoadingOverlay label="소셜 피드를 불러오는 중입니다" /></>;
}
