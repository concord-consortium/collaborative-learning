import React from "react";
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
import HideObjectIcon from "../assets/hide-object-icon.svg";
import ShowObjectIcon from "../assets/show-object-icon.svg";
import { useUIStore } from "../../../hooks/use-stores";


interface IObjectListViewProps {
  model: ITileModel,
  setHoverObject: (value: string|null) => void
}

export const ObjectListView = observer(function ObjectListView({model, setHoverObject}: IObjectListViewProps) {

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
    getContent().setListViewOpen(true);
  }

  function handleClose() {
    getContent().setListViewOpen(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event;
    if (over && active.id !== over.id) {
      const content = getContent();
      content.changeZOrder(active.id as string, over.id as string);
    }
  }

  if (getContent().listViewOpen) {
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
                    tileId={model.id}
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
  tileId: string,
  content: DrawingContentModelType,
  selection: string[],
  setHoverObject: (id: string|null) => void
}

const ObjectLine = observer(function ObjectLine(
    {object, tileId, content, selection, setHoverObject}: IObjectLineProps) {

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    active,
    isDragging
  } = useSortable({id: object.id});

  const ui = useUIStore();

  function handleHoverIn() {
    if (active) return; // avoid flashes of highlight while dragging
    setHoverObject(object.id);
  }

  function handleHoverOut() {
    setHoverObject(null);
  }

  function handleMouseDown(e: React.MouseEvent) {
    // Normally mouseDown events bubble up to the tile, which will select it or de-select if there are modifier keys.
    // In this case we never want to de-select the tile, but we do want to select it if it isn't already.
    e.stopPropagation();
    ui.setSelectedTileId(tileId);
  }

  // Select the clicked object, or add to existing selection with modifier key.
  function handleClick(e: React.MouseEvent) {
    if (e.shiftKey || e.metaKey) {
      content.selectId(object.id);
    } else {
      content.setSelectedIds([object.id]);
    }
  }

  function handleShow(e: React.MouseEvent) {
    e.stopPropagation();
    object.setVisible(true);
  }

  function handleHide(e: React.MouseEvent) {
    e.stopPropagation();
    object.setVisible(false);
    if (content.isIdSelected(object.id)) {
      content.unselectId(object.id);
    }
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const visibilityIcon =
    object.visible
      ? <button type="button" className="visibility-icon" onClick={handleHide}>
          <HideObjectIcon viewBox="0 0 24 24"/>
        </button>
      : <button type="button" className="visibility-icon" onClick={handleShow}>
          <ShowObjectIcon viewBox="0 0 24 24"/>
        </button>;

  return (
    <li ref={setNodeRef}
        style={style}
        className={classNames({
          selected: selection.includes(object.id),
          invisible: !object.visible,
          dragging: isDragging
        })}
        onMouseEnter={handleHoverIn}
        onMouseLeave={handleHoverOut}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
    >
      <span className="type-icon">
        {object.icon}
      </span>
      <span className="label">{object.label}</span>
      {visibilityIcon}
      <MoveIcon className="move-icon"
              {...attributes}
              {...listeners}
      />
    </li>
  );
});
