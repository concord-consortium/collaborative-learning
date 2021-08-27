import { observer } from "mobx-react";
import { useEffect } from "react";
import { usePrevious } from "../../hooks/use-previous";
import { useUIStore } from "../../hooks/use-stores";

/*
 * ReferenceDocumentTracker
 *
 * This component is basically a hook wrapped in a functional component so that
 * it can be called from a class component (NavTabPanel in this case). It's basic
 * purpose is to walk the DOM to figure out what user document or curriculum section
 * is currently visible in the left-side navigation panel for the purpose of deciding
 * what document or curriculum section can be commented upon in the comments panel.
 * We had been trying to determine this by tracking clicks in the various tab headers
 * but this was getting increasingly complicated and wasn't working very well. This
 * ties the behavior of the comments panel to what's actually visible to the user, as
 * it should be. The mechanism is that components that are responsible for presenting
 * documents or curriculum sections to the user add a `data-reference-document` or
 * `data-reference-section` attribute which can then be detected when we crawl the
 * DOM thus guaranteeing that we're finding the top-most visible documents/sections.
 */
interface IProps {
  navTabPanelElt: HTMLDivElement | null;
}
export const FocusDocumentTracker = observer(({ navTabPanelElt }: IProps) => {
  // this component is basically a hook wrapped in a functional component so that
  // it can be called from a class component (NavTabPanel in this case).
  const ui = useUIStore();
  const prevUpdates = usePrevious(ui.refDocUpdates);
  useEffect(() => {

    if (navTabPanelElt && (ui.refDocUpdates !== prevUpdates)) {
      // set a timer to allow rendering to complete
      setTimeout(() => {
        let referenceDocument: string | undefined;
        let referenceSection: string | undefined;

        // find elements at a point below the rows of tab headers
        const bounds = navTabPanelElt.getBoundingClientRect();
        const kHeaderHeight = 34;
        const kMaxHeadersHeight = 3 * kHeaderHeight;
        const kOffset = 10;
        const testLeft = bounds.left + kOffset;
        const testTop = bounds.top + kMaxHeadersHeight + kOffset;
        const elements = document.elementsFromPoint(testLeft, testTop);

        // loop through elements looking for data attributes
        // note that although it's not mentioned on MDN or other documentation sites,
        // the spec makes clear that the elements are returned in front-to-back order.
        for (let i = 0; !referenceDocument && (i < elements.length); ++i) {
          const elt = elements[i];
          const refDoc = elt.getAttribute("data-reference-document");
          const refSec = elt.getAttribute("data-reference-section");
          refDoc && (referenceDocument = refDoc);
          refSec && (referenceSection = refSec);
        }
        ui.setFocusDocument(referenceSection
                              ? `${referenceDocument}/${referenceSection}`
                              : referenceDocument);
      }, 30);
    }
  }, [navTabPanelElt, prevUpdates, ui, ui.refDocUpdates]);
  return null;
});
