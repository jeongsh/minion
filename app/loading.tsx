import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";
import { RootLoadingSkeleton } from "@/components/navigation/root-loading-skeleton";

export default function Loading() {
  return (
    <>
      <RootLoadingSkeleton />
      <NavigationLoadingOverlay />
    </>
  );
}
