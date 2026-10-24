// 화면에 그리기 전에 이미지를 미리 받아두는 유틸. load(또는 error)까지 기다린 뒤
// 가능하면 decode()까지 끝내고 resolve 한다. error 시에도 resolve 하므로 영영 멈추지 않는다.
// new Image()는 함수 호출 시점(브라우저)에서만 실행되므로 SSR 번들에 포함돼도 안전하다.
export function preloadImage(url: string, timeoutMs = 3000) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;
    const timeout = window.setTimeout(() => {
      settled = true;
      image.src = "";
      resolve();
    }, timeoutMs);

    const finish = async () => {
      if (settled) return;
      settled = true;
      if (typeof image.decode === "function") {
        await image.decode().catch(() => undefined);
      }
      window.clearTimeout(timeout);
      resolve();
    };

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
    image.src = url;
    if (image.complete) void finish();
  });
}
