import { observer } from "mobx-react";
import { useEffect } from "react";
import { usePrevious } from "../../hooks/use-previous";
import { useUIStore } from "../../hooks/use-stores";

interface IProps {
  navTabPanelElt: HTMLDivElement | null;
}
export const ReferenceDocumentTracker = observer(({ navTabPanelElt }: IProps) => {
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
        ui.setReferenceDocument(referenceSection
                                  ? `${referenceDocument}/${referenceSection}`
                                  : referenceDocument);
        console.log("ReferenceDocumentTracker", "referenceDocument:", ui.referenceDocument);
      }, 30);
    }
  }, [navTabPanelElt, prevUpdates, ui, ui.refDocUpdates]);
  return null;
});
