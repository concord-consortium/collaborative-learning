import * as React from "react";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import "./blueprint.sass";

export function renderUnicodeCharAsIconElement(char: string) {
  return (<span className="unicode-icon-element">{char}</span>);
}
