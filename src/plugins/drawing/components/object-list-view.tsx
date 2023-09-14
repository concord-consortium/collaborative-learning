import React, { useState } from "react";
import { observer } from "mobx-react";
import classNames from "classnames";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { DrawingContentModelType } from "../model/drawing-content";
import { DrawingObjectType } from "../objects/drawing-object";
import { ITileModel } from "../../../models/tiles/tile-model";
import ExpandRightIcon from "../assets/expand-right-icon.svg";
import ExpandLeftIcon from "../assets/expand-left-icon.svg";
import MoveIcon from "../assets/move-icon.svg";

interface IObjectListViewProps {
  model: ITileModel,
  setHoverObject: (value: string|null) => void
}

export const ObjectListView = observer(function ObjectListView({model, setHoverObject}: IObjectListViewProps) {

  const [open, setOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  function getContent() {
    return model.content as DrawingContentModelType;
  }

  function handleOpen() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      const content = getContent();
      content.changeZOrder(active.id as string, over.id as string);
    }
  }

  if (open) {
    const content = getContent();
    const selection = content.selection;
    const objectIdList = content.objects.map((obj)=>obj.id).reverse();

    return (
    <div data-testid="object-list-view" className="object-list open">
      <div className="header">
        <button type="button" className="close" onClick={handleClose} aria-label="Close show/sort panel">
          Show/sort
          <ExpandLeftIcon/>
        </button>
      </div>
      <div className="body">
        <ul>
          <DndContext 
            sensors={sensors}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={handleDragEnd}>
            <SortableContext items={objectIdList} 
              strategy={verticalListSortingStrategy}
              >
              {objectIdList.map((id) => { return (
                  <ObjectLine 
                    key={id} 
                    object={content.objectMap[id] as DrawingObjectType} 
                    content={content} 
                    selection={selection} 
                    setHoverObject={setHoverObject} />);
              })}
            </SortableContext>
          </DndContext>
        </ul>
      </div>
    </div>);

  } else {
    return (
    <div data-testid="object-list-view" className="object-list closed">
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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({id: object.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const Icon = object.icon;
  return (
    <li ref={setNodeRef}
        style={style}
        className={classNames({
          selected: selection.includes(object.id),
          dragging: isDragging
        })}
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        onClick={handleClick}
    >
      <Icon className="type-icon" width={20} height={20} viewBox="0 0 36 34" stroke="#000000" fill="#FFFFFF" />
      <span className="label">{object.label}</span>
      <MoveIcon className="move-icon"
              {...attributes}
              {...listeners}
      />
    </li>
  );
}
