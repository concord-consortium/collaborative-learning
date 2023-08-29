import React, { useState } from "react";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingObjectType } from "../objects/drawing-object";
import { ITileModel } from "src/models/tiles/tile-model";
import { observer } from "mobx-react";
import classNames from "classnames";


interface IObjectListViewProps {
  model: ITileModel
}

export const ObjectListView = observer(function ObjectListView({model}: IObjectListViewProps) {

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
      (obj) => { return (<ObjectLine key={obj.id} object={obj} selection={selection}/>); });

    return (
    <div className="object-list open">
      <div className="header">
        <h4>Show/Sort</h4>
        <button type="button" className="close" onClick={handleClose} aria-label="Close show/sort panel">&lt;</button>
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
      <button type="button" onClick={handleOpen} aria-label="Open show/sort panel">&gt;</button>
    </div>);
  }

});

interface IObjectLineProps {
  object: DrawingObjectType,
  selection: string[]
}

function ObjectLine({object, selection}: IObjectLineProps) {
  return (
    <li className={classNames({selected: selection.includes(object.id)})}>{object.description}</li>
  );
}
