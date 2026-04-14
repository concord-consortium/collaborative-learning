/**
 * Returns all visible, focusable elements within a container, in DOM order.
 * Handles SVG <g> elements (which fail checkVisibility) via bounding rect fallback.
 */
export function getVisibleFocusables(container: HTMLElement | Element): (HTMLElement | SVGElement)[] {
  const selector = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])', 'textarea:not([disabled])', '[contenteditable]:not([contenteditable="false"])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(", ");

  return Array.from(
    container.querySelectorAll<HTMLElement | SVGElement>(selector)
  ).filter(el => {
    if (el.closest('[aria-hidden="true"]')) return false;
    if (el instanceof SVGElement) {
      const svgRect = el.getBoundingClientRect();
      return svgRect.width > 0 && svgRect.height > 0;
    }
    const check = (el as any).checkVisibility;
    if (typeof check === "function") {
      return check.call(el, { checkOpacity: true, checkVisibilityCSS: true });
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

/**
 * Returns the focusable title element inside an .editable-tile-title wrapper.
 * In view mode this is .editable-tile-title-text (tabindex=-1, programmatically focusable).
 * In edit mode this is the <input> that replaces the text element.
 */
export function getEditableTitleElement(tileElement: HTMLElement | null | undefined): HTMLElement | undefined {
  const wrapper = tileElement?.querySelector('.editable-tile-title');
  return wrapper?.querySelector('input, .editable-tile-title-text') as HTMLElement | undefined;
}

// cf. https://developer.mozilla.org/en-US/docs/Web/API/Element/matches#Polyfill
if (!Element.prototype.matches) {
  Element.prototype.matches = (Element.prototype as any).msMatchesSelector ||
                              (Element.prototype as any).webkitMatchesSelector;
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
