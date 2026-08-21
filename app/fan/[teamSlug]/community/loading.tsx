import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { FanCommunityLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><FanCommunityLoadingSkeleton /><NavigationLoadingOverlay label="팀 게시글을 불러오는 중입니다" /></>;
}
