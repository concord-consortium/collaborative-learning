import { observer } from "mobx-react";
import React, { useRef } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { VListContentModelType } from "./vlist-content";
import "./vlist-tool.scss";

export const VListToolComponent: React.FC<IToolTileProps> = observer((props) => {
  const content = props.model.content as VListContentModelType;

  const inputEl = useRef<HTMLInputElement>(null);
  const onButtonClick = () => {
    const text = inputEl.current?.value;
    if (!text) {
      return;
    }
    content.addVariable(text);
  };

  return (
    <div className="vlist-tool">
      <input ref={inputEl}></input>
      <button onClick={onButtonClick}>Add Item</button>
      <ul>
        { content.variables.map((variable, index) => <li key={index}>{variable}</li> )}
      </ul>
    </div>
  );
});
VListToolComponent.displayName = "VListToolComponent";
