// AdMob content mapping must describe the screen the user sees. Only ad
// screens whose public web page shows the same content send a URL.
const WEB_ORIGIN = 'https://minion.fan';
const MAX_CONTENT_URL_LENGTH = 512;
const SAME_CONTENT_PAGES = [
  /^$/,
  /^\/(?:schedule|tournaments|transfers|players|champions|community)$/,
  /^\/(?:players|champions|matches)\/[^/]+$/,
  /^\/community\/post\/[^/]+$/,
  /^\/fan\/[^/]+(?:\/matches|\/community(?:\/post\/[^/]+|\/(?!new$|post$)[^/]+)?)?$/,
];
// The app team schedule tab renders the web team match calendar.
const FAN_SCHEDULE = /^(\/fan\/[^/]+)\/schedule$/;

function encodeSegment(segment: string) {
  try { return encodeURIComponent(decodeURIComponent(segment)); }
  catch { return encodeURIComponent(segment); }
}

export function getAdContentUrl(pathname: string): string | undefined {
  const path = pathname.split('/').map(encodeSegment).join('/').replace(/\/+$/, '').replace(FAN_SCHEDULE, '$1/matches');
  if (!SAME_CONTENT_PAGES.some(page => page.test(path))) return undefined;
  const url = `${WEB_ORIGIN}${path || '/'}`;
  return url.length <= MAX_CONTENT_URL_LENGTH ? url : undefined;
}
