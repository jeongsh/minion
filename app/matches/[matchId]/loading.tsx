import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { MatchLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return (
    <>
      <MatchLoadingSkeleton />
      <NavigationLoadingOverlay label="매치 데이터를 불러오는 중입니다" />
    </>
  );
}
