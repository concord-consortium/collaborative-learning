import classNames from "classnames";
import { observer } from "mobx-react";
import React, { useEffect, useState } from "react";
import { ExpressionContentModelType } from "../../plugins/expression/expression-content";
import { DataCardContentModelType } from "../../plugins/data-card/data-card-content";

type SimpleTitleTileTypes = DataCardContentModelType | ExpressionContentModelType;

interface IProps {
  model: any;
  onRequestUniqueTitle: any;
  readOnly: boolean | undefined;
}

export const CustomEditableTileTitle: React.FC<IProps> = observer((props) => {
  const { model, onRequestUniqueTitle, readOnly } = props;
  const content = model.content as SimpleTitleTileTypes;

  const [titleValue, setTitleValue] = useState(content.title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    if (!content.title) {
      const title = onRequestUniqueTitle(model.id);
      title && content.setTitle(title);
    }
  }, [content, model.id, onRequestUniqueTitle]);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTitleValue(event.target.value);
  };

  const handleTitleClick = () => {
    if (!readOnly){
      setIsEditingTitle(true);
    }
  };

  const handleTitleInputClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.focus();
    const isHighlighted = event.currentTarget.selectionStart === 0;
    const valLength = event.currentTarget.value.length;
    if (isHighlighted && valLength > 0){
        event.currentTarget.setSelectionRange(valLength, valLength, "forward");
    }
  };

  const handleTitleInputDoubleClick = (event: React.MouseEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "Enter":
        handleCompleteTitle();
        setIsEditingTitle(false);
        break;
      case "Escape":
        setTitleValue(content.title);
        setIsEditingTitle(false);
        break;
    }
  };

  const handleCompleteTitle = () => {
    if (titleValue){
      content.setTitle(titleValue);
    }
    setIsEditingTitle(false);
  };

  const elementClasses = classNames(
    "title-text-element", {editing: isEditingTitle}
  );

  return (
    <div className={elementClasses}>
      { isEditingTitle && !readOnly
      ? <input
          className="title-input-editing"
          value={titleValue}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          onBlur={handleCompleteTitle}
          onClick={handleTitleInputClick}
          onDoubleClick={handleTitleInputDoubleClick}
      />
      : <div className="editable-title-text" onClick={handleTitleClick}>
          { content.title }
        </div>
      }
    </div>
  );
});
CustomEditableTileTitle.displayName = "CustomEditableTileTitle";
