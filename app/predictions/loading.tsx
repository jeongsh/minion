import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { PredictionLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><PredictionLoadingSkeleton /><NavigationLoadingOverlay label="승부예측을 불러오는 중입니다" /></>;
}
