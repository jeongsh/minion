import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { ScheduleLoadingSkeleton } from "@/components/navigation/route-loading-skeleton";

export default function Loading() {
  return <><ScheduleLoadingSkeleton /><NavigationLoadingOverlay label="일정을 불러오는 중입니다" /></>;
}
