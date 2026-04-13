import React, { useContext } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { ReactEditor, registerElementComponent, RenderElementProps, useSelected, useSerializing, useSlate }
  from "@concord-consortium/slate-editor";
import { TextContentModelContext } from "../../components/tiles/text/text-content-context";
import "./link-plugin.scss";

export const kLinkFormat = "link";

// Type for link elements with CLUE's linkId extension.
// Declared as a standalone interface (not extending CustomElement, which is a
// union type that can't be extended via `extends`).
export interface ClueLinkElement {
  type: typeof kLinkFormat;
  href: string;
  linkId?: string;
  children: any[];
}

const isLinkElement = (element: any): element is ClueLinkElement =>
  element?.type === kLinkFormat;

export const LinkComponent = observer(function LinkComponent(
  { attributes, children, element }: RenderElementProps
) {
  const isSerializing = useSerializing();
  const textContent = useContext(TextContentModelContext);
  const isSelected = useSelected();
  const editor = useSlate();
  const readOnly = ReactEditor.isReadOnly(editor);

  if (!isLinkElement(element)) {
    return <span {...attributes}>{children}</span>;
  }

  const { href, linkId } = element;

  // During HTML export (serialization), render a plain <a> tag with no
  // interactive behavior, classes, or displayMode styling. This keeps
  // the exported HTML presentation-neutral.
  if (isSerializing) {
    return <a href={href} {...attributes}>{children}</a>;
  }

  const displayMode = textContent?.getLinkDisplayMode(linkId) ?? "link";

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // In editable mode + link display, let Slate handle clicks for cursor
    // placement unless the user holds cmd/ctrl (standard editor convention).
    if (!readOnly && displayMode === "link" && !(e.metaKey || e.ctrlKey)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
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
      contentEditable={displayMode === "button" ? false : undefined}
      onClick={handleClick}
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
