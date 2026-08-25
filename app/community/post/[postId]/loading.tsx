import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { CommunityPostLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><CommunityPostLoadingSkeleton /><NavigationLoadingOverlay label="게시글을 불러오는 중입니다" /></>;
}
