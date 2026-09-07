/** Retired public sections bypass the app layout, including its AdSense script. */
export function retiredPageResponse() {
  return new Response("이 페이지는 운영이 종료되었습니다.\n", {
    status: 410,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
