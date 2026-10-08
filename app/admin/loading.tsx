import { NeutralLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";
import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";

export default function Loading() {
  return <><NeutralLoadingSkeleton /><NavigationLoadingOverlay label="관리 화면을 불러오는 중입니다" /></>;
}
