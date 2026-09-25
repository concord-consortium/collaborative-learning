import { useEffect, useRef, useState } from "react";
import { gImageMap } from "../models/image-map";

// Start fetching a little before the image scrolls in, so it is usually ready by the time
// it is actually visible.
const kPrefetchMargin = "200px";

/**
 * Resolves an image reference to a displayable url, deferred until the element is near the
 * viewport.
 *
 * Views that render every case at once — the data card sort view — would otherwise fetch
 * every image on mount, a separate realtime-database round trip each. Attach the returned ref
 * to the element occupying the image's space so scrolling drives the fetch instead.
 *
 * Returns an empty string for anything that is not an image reference, and until the fetch
 * resolves.
 */
export function useLazyImage(url: string) {
  const [displayUrl, setDisplayUrl] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gImageMap.isImageUrl(url)) {
      setDisplayUrl("");
      return;
    }

    let cancelled = false;
    const fetchImage = () => {
      gImageMap.getImage(url).then(image => {
        if (!cancelled) setDisplayUrl(image.displayUrl || "");
      });
    };

    const element = ref.current;
    // Nothing to observe, or no observer to do it with (jsdom): keep the eager behavior.
    if (!element || typeof IntersectionObserver === "undefined") {
      fetchImage();
      return () => { cancelled = true; };
    }

    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      fetchImage();
    }, { rootMargin: kPrefetchMargin });
    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [url]);

  return { ref, displayUrl };
}
