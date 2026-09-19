/** Public reference URLs only. This module never fetches the supplied address. */
export function normalizeStudioSourceUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2_000) throw new Error("Invalid source URL");
  const url = new URL(value.trim());
  const host = url.hostname;
  if (url.protocol !== "https:" || url.port || url.username || url.password
    || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/i.test(host)
    || /(?:^|\.)(?:localhost|local|internal|lan|test|invalid|onion)$/.test(host)) throw new Error("Public HTTPS URL required");
  if (/(?:^|\/)(?:login|logout|signin|signout|admin|delete|edit|compose)(?:\/|$)/i.test(decodeURIComponent(url.pathname))) throw new Error("Public content URL required");
  for (const key of [...url.searchParams.keys()]) {
    if (/token|secret|password|signature|credential|session|api.?key|^(?:auth|code|act|action)$/i.test(key)) throw new Error("Public content URL required");
    if (/^utm_/i.test(key) || ["fbclid", "gclid"].includes(key)) url.searchParams.delete(key);
  }
  url.hash = "";
  if (["fmkorea.com", "www.fmkorea.com", "m.fmkorea.com"].includes(host)) {
    // Copied board links retain list presentation/search options, not article identity.
    for (const key of ["sort_index", "order_type", "listStyle", "page", "category", "search_target", "search_keyword"]) {
      url.searchParams.delete(key);
    }
    const shortId = url.pathname.match(/^\/(?:lol\/)?([0-9]{1,20})\/?$/)?.[1];
    const documentId = url.searchParams.get("document_srl");
    if (shortId) {
      if (url.search) throw new Error("Invalid article query");
      return `https://www.fmkorea.com/${shortId}`;
    }
    if ((url.pathname === "/index.php" || url.pathname === "/") && (url.searchParams.get("mid") === "lol" || (documentId && !url.searchParams.has("mid")))) {
      for (const key of url.searchParams.keys()) if (!["mid", "document_srl", "cpage"].includes(key) || url.searchParams.getAll(key).length > 1) throw new Error("Invalid article query");
      if (url.searchParams.has("cpage") && !/^[1-9][0-9]{0,3}$/.test(url.searchParams.get("cpage")!)) throw new Error("Invalid comment page");
      if (documentId) {
        if (!/^[0-9]{1,20}$/.test(documentId)) throw new Error("Invalid article ID");
        return `https://www.fmkorea.com/${documentId}`;
      }
      return "https://www.fmkorea.com/lol";
    }
    url.hostname = "www.fmkorea.com";
  }
  // A video has the same identity across its share, Shorts and watch URLs.
  if (["youtu.be", "youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) {
    const videoId = host === "youtu.be" ? url.pathname.slice(1) : url.pathname.match(/^\/(?:shorts|live|embed)\/([^/]+)\/?$/)?.[1] ?? (url.pathname === "/watch" ? url.searchParams.get("v") : null);
    if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId)) return `https://www.youtube.com/watch?v=${videoId}`;
  }
  url.searchParams.sort();
  return url.href;
}
