import classNames from "classnames";
import React from "react";
import { observer } from "mobx-react";
import { IButtonProps } from "../toolbar-button";
import { DocumentModelType } from "../../models/document/document";
import { SectionModelType } from "../../models/curriculum/section";
import { getReadAloudService } from "../../models/services/read-aloud-service";
import { useStores } from "../../hooks/use-stores";

interface IProps extends IButtonProps {
  pane: "left" | "right";
  document?: DocumentModelType;
  section?: SectionModelType;
}

export const ReadAloudButton: React.FC<IProps> = observer(function ReadAloudButton({
  toolButton, isDisabled: _isDisabled, pane, document: doc, section
}) {
  const stores = useStores();
  const service = getReadAloudService(stores);

  // Hide entirely if speech synthesis not supported
  if (!service.isSupported) return null;

  const content = doc?.content ?? section?.content;
  const isActive = service.state !== "idle" && service.activePane === pane;
  const hasTiles = (content?.getAllTileIds(false)?.length ?? 0) > 0;
  const isDisabled = (_isDisabled || !hasTiles) && !isActive;
  const tileEltClass = toolButton.id.toLowerCase();
  const className = classNames("tool", tileEltClass,
    { active: isActive }, isDisabled ? "disabled" : "enabled");

  const handleClick = () => {
    if (isDisabled && !isActive) return;
    if (isActive) {
      service.stop("user");
    } else if (content) {
      const selectedIds = Array.from(stores.ui.selectedTileIds);
      service.start(pane, content, selectedIds, { document: doc, section });
    }
  };

  return (
    // TODO: Replace <div role="button"> with a <button> element for proper
    // keyboard accessibility (tabIndex, Enter/Space handling) in future a11y work.
    <div
      className={className}
      data-testid={`tool-${tileEltClass}`}
      title={toolButton.title}
      onClick={handleClick}
      role="button"
      aria-pressed={isActive}
      aria-label={toolButton.title}
    >
      {toolButton.Icon && <toolButton.Icon />}
    </div>
  );
});
