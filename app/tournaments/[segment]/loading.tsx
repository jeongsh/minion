import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";

export default function Loading() {
  return (
    <>
      <main className="min-h-[calc(100vh-72px)] bg-[var(--page-background)]" aria-hidden="true" data-route-loading="true" />
      <NavigationLoadingOverlay />
    </>
  );
}
