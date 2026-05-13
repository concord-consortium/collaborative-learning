import React, { useContext } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { BaseElement, ReactEditor, registerElementComponent, RenderElementProps, useSelected, useSerializing,
  useSlate } from "@concord-consortium/slate-editor";
import { TextContentModelContext } from "../text-content-context";
import { kDefaultLinkDisplayMode } from "../../../../models/tiles/text/text-content";
import "./link-plugin.scss";

export const kLinkFormat = "link";

// Type for link elements with CLUE's linkId extension.
// Extends BaseElement (which provides children: Descendant[]) so it's
// assignable to Slate's Element type without casting.
export interface ClueLinkElement extends BaseElement {
  type: typeof kLinkFormat;
  href: string;
  linkId?: string;
}

const isLinkElement = (element: any): element is ClueLinkElement =>
  element?.type === kLinkFormat;

// Slate element components are invoked both interactively (inside a <Slate>
// provider) and during HTML serialization (slateToHtml statically renders
// elements with only a SerializingContext). Editor-bound hooks like useSlate
// are only valid on the interactive path, so this component is split into two
// children with useSerializing() picking which to render.
export const LinkComponent = (props: RenderElementProps) => {
  const isSerializing = useSerializing();
  if (isSerializing) return <LinkSerializing {...props} />;
  return <LinkInteractive {...props} />;
};

const LinkSerializing = ({ attributes, children, element }: RenderElementProps) => {
  if (!isLinkElement(element)) {
    return <span {...attributes}>{children}</span>;
  }

  // Render a plain <a> tag with no interactive behavior, classes, or displayMode styling.
  // This keeps the exported HTML presentation-neutral.
  return <a href={element.href} {...attributes}>{children}</a>;
};

const LinkInteractive = observer(function LinkInteractive(
  { attributes, children, element }: RenderElementProps
) {
  const textContent = useContext(TextContentModelContext);
  const isSelected = useSelected();
  const editor = useSlate();
  const readOnly = ReactEditor.isReadOnly(editor);

  if (!isLinkElement(element)) {
    return <span {...attributes}>{children}</span>;
  }

  const { href, linkId } = element;

  const displayMode = textContent?.getLinkDisplayMode(linkId) ?? kDefaultLinkDisplayMode;

  const isButtonMode = displayMode === "button";

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // In editable mode + link display, let Slate handle clicks for cursor
    // placement unless the user holds cmd/ctrl (standard editor convention).
    if (!readOnly && !isButtonMode && !(e.metaKey || e.ctrlKey)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Prevent drag-selection from pulling button content into the editor
    if (isButtonMode) {
      e.preventDefault();
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // In button mode, prevent Slate from starting a selection inside the button
    if (isButtonMode && !readOnly) {
      e.preventDefault();
    }
  };

  const className = classNames("slate-link", `${displayMode}-mode`, {
    "slate-selected": isSelected,
    "read-only": readOnly,
  });

  return (
    <a
      {...attributes}
      href={href}
      className={className}
      contentEditable={isButtonMode ? false : undefined}
      draggable={isButtonMode ? false : undefined}
      onClick={handleClick}
      onDragStart={handleDragStart}
      onMouseDown={isButtonMode ? handleMouseDown : undefined}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
});

let isRegistered = false;

export function registerLinkComponent() {
  if (isRegistered) return;
  registerElementComponent(kLinkFormat, props => <LinkComponent {...props}/>);
  isRegistered = true;
}
