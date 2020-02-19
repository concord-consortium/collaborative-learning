import * as React from "react";
const { useState } = React;
import { Button, Dialog } from "@blueprintjs/core";

interface IProps {
  isOpen: boolean;
  tableName?: string;
  maxLength?: number;
  onSetTableName: (name: string) => void;
  onClose: () => void;
}

const kDefaultMaxLength = 60;

export const SetTableNameDialog: React.FC<IProps> = ({ isOpen, tableName, maxLength, onSetTableName, onClose }) => {

  const [name, setName] = useState(tableName || "");

  const handleChange = (e: React.FormEvent<HTMLInputElement>) => {
    setName((e.target as HTMLInputElement).value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    (e.keyCode === 13) && onSetTableName(name);
  };

  const handleOkClick = () => {
    onSetTableName(name);
  };

  return (
    <Dialog
      icon="label"
      isOpen={isOpen}
      onClose={onClose}
      title={`Set Table Title`}
      canOutsideClickClose={false} >

      <div className="nc-attribute-name-prompt">Enter a title for the table:</div>
      <input
        className="nc-attribute-name-input pt-input"
        type="text"
        placeholder="Title"
        maxLength={maxLength || kDefaultMaxLength}
        value={name}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        dir="auto"
        ref={input => input?.focus()}
      />
      <div className="nc-dialog-buttons">
        <Button
          className="nc-dialog-button pt-intent-primary"
          text="OK"
          onClick={handleOkClick} />
        <Button className="nc-dialog-button" text="Cancel" onClick={onClose}/>
      </div>
    </Dialog>
  );
};
