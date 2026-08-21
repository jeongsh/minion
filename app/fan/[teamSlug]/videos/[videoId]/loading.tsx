import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { DetailLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><DetailLoadingSkeleton /><NavigationLoadingOverlay label="영상을 불러오는 중입니다" /></>;
}
