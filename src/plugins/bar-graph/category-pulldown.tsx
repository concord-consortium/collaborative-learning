import React from "react";
import { Menu, MenuButton, MenuItem, MenuList, Portal } from "@chakra-ui/react";
import { useReadOnlyContext } from "../../components/document/read-only-context";

import DropdownCaretIcon from "../dataflow/assets/icons/dropdown-caret.svg";


interface IProps {
  categoryList: string[];
  category: string;
  setCategory: (category: string) => void;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function CategoryPulldown({categoryList, category, setCategory, x, y, width, height}: IProps) {
  const readOnly = useReadOnlyContext();

  return (
    <foreignObject data-testid="category-pulldown" x={x} y={y} width={width} height={height}>
      <Menu boundary="scrollParent">
        <MenuButton>
          <span className="button-content">
            <span className="button-text">{category}</span>
            <DropdownCaretIcon/>
          </span>
        </MenuButton>
        <Portal>
          <MenuList>
            {categoryList.map((c) => (
              <MenuItem isDisabled={readOnly} key={c} onClick={() => setCategory(c)}>{c}</MenuItem>
            ))}
          </MenuList>
        </Portal>
      </Menu>
    </foreignObject>
  );
}
