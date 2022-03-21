import { observer } from "mobx-react";
import { getSnapshot } from "mobx-state-tree";
import React, { useRef } from "react";
import { IToolTileProps } from "../../components/tools/tool-tile";
import { VListContentModelType, VListItemType } from "./vlist-content";
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
        { content.items.map((item, index) => (
          <li key={index}> 
            <button onClick={() => content.moveUp(item)}>^</button> 
            {item.name}: {item.valueAsString} {item.unit}
            <button onClick={() => content.remove(item)}>x</button>
          </li> 
        ))}
      </ul>
    </div>
  );
});
VListToolComponent.displayName = "VListToolComponent";
