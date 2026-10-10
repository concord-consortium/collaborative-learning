import React from "react";
import { useCustomModal } from "../../../hooks/use-custom-modal";
import InfoIcon from "../assets/info-icon.svg";
import "./timeline-info-button.scss";

const kModalTitle = "Zooming and Moving";

function TimelineInfoContent() {
  return (
    <>
      <p>
        Zoom in and out with the Zoom In and Zoom Out buttons. Or click the graph to zoom in on that
        spot, and shift+click to zoom back out.
      </p>
      <p>
        Move sideways with the Pan Left and Pan Right buttons, or click+hold+drag the graph left or
        right.
      </p>
      <p>
        The Full Timeline below the graph shows the whole timeline at once. The shaded box marks the
        part you’re viewing above — drag it, or the gray bar beneath it, to move to a different part
        of the graph.
      </p>
    </>
  );
}

export function TimelineInfoButton() {
  const [showModal] = useCustomModal({
    className: "timeline-info-modal",
    title: kModalTitle,
    Icon: InfoIcon,
    Content: TimelineInfoContent,
    contentProps: {},
    focusElement: ".modal-button",
    describeContent: true,
    canCancel: true,
    buttons: [{ label: "OK" }],
    dataTestId: "timeline-info-modal"
  });

  return (
    <button type="button" className="timeline-info-button" aria-label={kModalTitle} aria-haspopup="dialog"
        onClick={() => showModal()}>
      <InfoIcon aria-hidden="true" />
    </button>
  );
}
