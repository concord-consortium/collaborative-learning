// cf. https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
if (!Element.prototype.matches) {
  Element.prototype.matches = (Element.prototype as any).msMatchesSelector ||
                              Element.prototype.webkitMatchesSelector;
}

// cf. https://developer.mozilla.org/en-US/docs/Web/API/Element/closest#Polyfill
if (!Element.prototype.closest) {
  Element.prototype.closest = function(selector: string) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let el: any = this;
    do {
      if (el.matches(selector)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}
