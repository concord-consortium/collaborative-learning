import React, { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { VisuallyHidden } from "@chakra-ui/react";
import { IDropdownItem } from "@concord-consortium/react-components";
import { useDropdown } from "@concord-consortium/accessibility-tools/hooks";
import classNames from "classnames";
import ArrowIcon from "../../assets/icons/arrow/arrow.svg";

import "./custom-select.scss";

export interface ICustomDropdownItem extends IDropdownItem {
  id?: string;
  itemIcon?: ReactNode;
  hideItemCheck?: boolean;
  bottomBorder?: boolean;
}

function getItemId(item: ICustomDropdownItem) {
  return item.id || item.text.toLowerCase().replace(/\s+/g, "-");
}

interface IProps {
  className?: string;
  dataTest?: string;
  dataTestId?: string;
  items: ICustomDropdownItem[];
  isDisabled?: boolean;
  showItemChecks?: boolean; // default true for existing clients
  showItemIcons?: boolean;  // default false
  title?: string;
  titlePrefix?: string;
  titleIcon?: ReactNode;
  titleVisuallyHidden?: boolean;
}

export const CustomSelect: React.FC<IProps> = (props) => {
  const {
    className, isDisabled, items, showItemChecks, showItemIcons,
    title, titlePrefix, titleIcon, titleVisuallyHidden,
    dataTest, dataTestId,
  } = props;

  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState(() =>
    items.find(item => item.selected)?.text || (items.length > 0 ? items[0].text : "")
  );

  // Sync selected state when items change externally
  useEffect(() => {
    const newSelected = items.find(i => i.selected);
    if (newSelected) {
      setSelected(newSelected.text);
    }
  }, [items]);

  const handleSelect = useCallback((_element: HTMLElement, index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;
    item.onClick?.(item);
    setSelected(item.text);
  }, [items]);

  const dropdown = useDropdown({
    triggerRef,
    listRef,
    itemSelector: ".list-item",
    onSelect: handleSelect,
    disabled: isDisabled || items.length === 0,
    label: title || titlePrefix,
  });

  const getDataTest = (suffix?: string) => {
    return `${dataTest || "custom-select"}${suffix ? "-" + suffix : ""}`;
  };

  const getDataTestIdValue = (suffix?: string) => {
    return `${dataTestId || dataTest || "custom-select"}${suffix ? "-" + suffix : ""}`;
  };

  const selectedItem = items.find(i => i.text === selected);
  const titleText = title || selectedItem?.text;
  const showListClass = dropdown?.isOpen ? "show-list" : "";
  const disabledClass = isDisabled || items.length === 0 ? "disabled" : "";

  const titleMarkup =
    titleVisuallyHidden
      ? <VisuallyHidden>{titlePrefix} {titleText}</VisuallyHidden>
      : titlePrefix
        ? <div className="title-container">
            <div className="title-prefix" data-test={getDataTest("title-prefix")}>{titlePrefix}</div>
            <div className="title" data-test={getDataTest("title")}>{titleText}</div>
          </div>
        : <div className="item line-clamp">{titleText}</div>;

  return (
    <div className={`custom-select ${className || ""}`}
        data-test={getDataTest()}
        data-testid={getDataTestIdValue()}>
      <div
        ref={triggerRef}
        className={`header ${showListClass} ${disabledClass}`}
        data-test={getDataTest("header")}
        data-testid={getDataTestIdValue("header")}
        {...(dropdown?.triggerProps ?? {})}
      >
        {titleIcon && <div className="title-icon">{titleIcon}</div>}
        {titleMarkup}
        <ArrowIcon className={`arrow ${showListClass} ${disabledClass}`} />
      </div>
      {(!isDisabled && items.length > 0) && (
        <div
          ref={listRef}
          className={`list ${dropdown?.isOpen ? "show" : ""}`}
          data-test={getDataTest("list")}
          data-testid={getDataTestIdValue("list")}
          {...(dropdown?.listProps ?? {})}
        >
          {items.map((item, i) => {
            const itemDisabledClass = item.disabled ? "disabled" : "enabled";
            const selectedClass = selected === item.text ? "selected" : "";
            const itemId = getItemId(item);
            const itemProps = dropdown?.getItemProps(i) ?? {};
            return (
              <div
                key={`item-${i}-${itemId}`}
                className={classNames(`list-item ${itemDisabledClass} ${selectedClass}`,
                  { bottomBorder: item.bottomBorder })}
                data-test={`list-item-${itemId}`}
                data-testid={`list-item-${itemId}`}
                aria-disabled={item.disabled ? true : undefined}
                {...itemProps}
              >
                {(showItemChecks !== false) &&
                  <div className={classNames("check", selectedClass, {
                    "hidden-item-check": item.hideItemCheck})}
                  />}
                {showItemIcons && (
                  <div className={`item-icon ${itemId}`}>
                    {item.itemIcon}
                  </div>
                )}
                <div className="item">{item.text}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
