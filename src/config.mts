import isMobilejs from "ismobilejs";
import uaParse from "ua-parser-js";

export let coneBackScale = 0.5;

export let isMobile = isMobilejs(window.navigator).any; // TODO test

export let ua = (() => {
  let ua = uaParse(window.navigator.userAgent);
  return ua;
})();
