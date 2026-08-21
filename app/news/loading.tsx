import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { NewsLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><NewsLoadingSkeleton /><NavigationLoadingOverlay label="뉴스를 불러오는 중입니다" /></>;
}
