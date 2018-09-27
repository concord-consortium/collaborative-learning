export function isChrome() {
  // cf. https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#Browser_Name
  return (navigator.userAgent.indexOf("Chrome") >= 0) &&
        (navigator.userAgent.indexOf("Chromium") < 0);
}

export function isFirefox() {
  // cf. https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#Browser_Name
  return (navigator.userAgent.indexOf("Firefox") >= 0) &&
        (navigator.userAgent.indexOf("Seamonkey") < 0);
}

export function isSafari() {
  // cf. https://developer.mozilla.org/en-US/docs/Web/HTTP/Browser_detection_using_the_user_agent#Browser_Name
  return (navigator.userAgent.indexOf("Safari") >= 0) &&
        (navigator.userAgent.indexOf("Chrome") < 0) &&
        (navigator.userAgent.indexOf("Chromium") < 0);
}
