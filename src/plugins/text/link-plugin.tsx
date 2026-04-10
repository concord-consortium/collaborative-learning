import React, { useContext } from "react";
import classNames from "classnames";
import { observer } from "mobx-react";
import { CustomElement, ReactEditor, registerElementComponent, RenderElementProps, useSelected, useSlate }
  from "@concord-consortium/slate-editor";
import { TextContentModelContext } from "../../components/tiles/text/text-content-context";
import "./link-plugin.scss";

export const kLinkFormat = "link";

interface ClueLinkElement extends CustomElement {
  type: typeof kLinkFormat;
  href: string;
  linkId?: string;
}

const isLinkElement = (element: any): element is ClueLinkElement =>
  element?.type === kLinkFormat;

export const LinkComponent = observer(function LinkComponent(
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

registerLinkComponent();
