import React, { useState } from "react";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingObjectType } from "../objects/drawing-object";
import { ITileModel } from "src/models/tiles/tile-model";
import { observer } from "mobx-react";
import classNames from "classnames";
import ExpandRightIcon from "../assets/expand-right-icon.svg";
import ExpandLeftIcon from "../assets/expand-left-icon.svg";

interface IObjectListViewProps {
  model: ITileModel,
  setHoverObject: (value: string|null) => void
}

export const ObjectListView = observer(function ObjectListView({model, setHoverObject}: IObjectListViewProps) {

  const [open, setOpen] = useState(false);

  function getContent() {
    return model.content as DrawingContentModelType;
  }

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  if (open) {
    const content = getContent();
    const selection = content.selection;
    const objectList = content.objects.slice().reverse().map(
      (obj) => { return (<ObjectLine key={obj.id} object={obj} content={content} selection={selection} 
        setHoverObject={setHoverObject} />); 
      });

    return (
    <div className="object-list open">
      <div className="header">
        <button type="button" className="close" onClick={handleClose} aria-label="Close show/sort panel">
          Show/sort
          <ExpandLeftIcon/>
        </button>
      </div>
      <div className="body">
        <ul>
          {objectList}
        </ul>
      </div>
    </div>);

  } else {
    return (
    <div className="object-list closed">
      <button type="button" onClick={handleOpen} aria-label="Open show/sort panel">
        <ExpandRightIcon/>
        <span className="vert">Show/sort</span>
      </button>
    </div>);
  }

});

interface IObjectLineProps {
  object: DrawingObjectType,
  content: DrawingContentModelType,
  selection: string[],
  setHoverObject: (id: string|null) => void
}

function ObjectLine({object, content, selection, setHoverObject}: IObjectLineProps) {

  function handleHoverIn() {
    setHoverObject(object.id);
  }

  function handleHoverOut() {
    setHoverObject(null);
  }

  function handleClick() {
    content.setSelectedIds([object.id]);
  }

  const Icon = object.icon;
  return (
    <li className={classNames({selected: selection.includes(object.id)})}
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        onClick={handleClick}
    >
      <Icon width={20} height={20} viewBox="0 0 36 34" stroke="#000000" fill="#FFFFFF" />
      {object.description}
    </li>
  );
}
