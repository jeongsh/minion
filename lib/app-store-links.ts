export const IOS_APP_STORE_ID = "6826082325";
export const ANDROID_PACKAGE_NAME = "com.minion.app";

export const IOS_APP_STORE_URL = `https://apps.apple.com/kr/app/minion/id${IOS_APP_STORE_ID}`;
export const ANDROID_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}&hl=ko`;

// 이벤트가 바뀌면 키를 바꿔 이전에 닫은 사용자에게도 새 배너가 다시 보이게 한다.
export const APP_LAUNCH_BANNER_DISMISS_KEY = "minion:app-launch-banner-dismissed:v1";

/**
 * 첫 페인트 전에 실행해 배너 노출 상태와 모바일 OS를 html 속성으로 고정한다.
 * - iOS Safari는 apple-itunes-app 메타로 Safari 기본 스마트 앱 배너가 뜨므로 자체 배너를 숨긴다.
 * - 닫은 사용자는 배너 영역 없이 렌더해 레이아웃이 튀지 않게 한다.
 */
export const appBannerInitScript = `
(function(){
  try {
    var root = document.documentElement;
    var ua = navigator.userAgent || '';
    var isIOS = /iP(hone|od|ad)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var isAndroid = /Android/i.test(ua);
    var isIOSSafari = isIOS && /Safari\\//.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|NAVER|Whale|KAKAOTALK|Instagram|FBAN|FBAV|Line\\//.test(ua);
    root.setAttribute('data-mobile-os', isIOS ? 'ios' : (isAndroid ? 'android' : 'other'));
    var dismissed = false;
    try { dismissed = localStorage.getItem('${APP_LAUNCH_BANNER_DISMISS_KEY}') === '1'; } catch (e) {}
    if (dismissed || isIOSSafari) root.setAttribute('data-app-banner-hidden', '');
  } catch (e) {}
})();
`;
