import React from "react";
import { observer } from "mobx-react";
import { Menu, MenuButton, MenuItem, MenuList, Portal } from "@chakra-ui/react";
import { useReadOnlyContext } from "../../components/document/read-only-context";
import { useBarGraphModelContext } from "./bar-graph-content-context";

import DropdownCaretIcon from "../../assets/dropdown-caret.svg";


interface IProps {
  setCategory: (category: string) => void;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const CategoryPulldown = observer(function CategoryPulldown({setCategory, x, y, width, height}: IProps) {
  const readOnly = useReadOnlyContext();
  const model = useBarGraphModelContext();

  const dataSet = model?.dataSet?.dataSet;
  const attributes = dataSet?.attributes || [];
  const current = (dataSet && model.primaryAttribute)
    ? dataSet.attrFromID(model.primaryAttribute)?.name
    : "Categories";

  return (
    <foreignObject data-testid="category-pulldown" x={x} y={y} width={width} height={height}>
      <Menu boundary="scrollParent">
        <MenuButton className="dropdown-menu-button">
          <span className="button-content">
            <span className="button-text">{current}</span>
            <DropdownCaretIcon/>
          </span>
        </MenuButton>
        <Portal>
          <MenuList>
            {attributes.map((a) => (
              <MenuItem isDisabled={readOnly} key={a.id} onClick={() => setCategory(a.id)}>{a.name}</MenuItem>
            ))}
          </MenuList>
        </Portal>
      </Menu>
    </foreignObject>
  );
});

export default CategoryPulldown;

