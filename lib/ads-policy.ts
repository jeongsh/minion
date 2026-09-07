// Only implemented content placements may opt in. New routes default to no ads.
export function hasAdPostContent(content: string): boolean {
  // Empty editor markup and embed-only posts are not editorial content.
  return content.replace(/<[^>]*>/g, " ").replace(/&(?:nbsp|#160|#xA0);/gi, " ").trim().length > 0;
}

export function isAdContentPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/"
    || /^\/matches\/[^/]+$/.test(path)
    || /^\/players\/[^/]+$/.test(path)
    || /^\/fan\/[^/]+$/.test(path)
    || path === "/community"
    || /^\/community\/post\/[^/]+$/.test(path)
    || /^\/fan\/[^/]+\/community$/.test(path)
    || /^\/fan\/[^/]+\/community\/post\/[^/]+$/.test(path)
    || path === "/predictions";
}

// These content pages have no manual slots; Auto ads formats are set in AdSense.
export function isRailAdContentPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === "/schedule" || path === "/players" || /^\/tournaments\/[^/]+$/.test(path);
}
