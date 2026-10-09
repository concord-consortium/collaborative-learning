import React, { ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
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
  /** Id(s) of the element(s) naming this control's purpose for assistive tech, e.g. the id of a
   *  visible `<label>` for the field. On a `role="button"` element, `aria-label` REPLACES the text
   *  content as the accessible name - it does not supplement it - so an `aria-label` here would
   *  announce only the field's purpose and never the chosen value once one is picked. Passing the
   *  label's id through `aria-labelledby` instead, alongside the header's own id, concatenates the
   *  two: the field's purpose AND its current value. */
  ariaLabelledBy?: string;
}

export const CustomSelect: React.FC<IProps> = (props) => {
  const {
    className, isDisabled, items, showItemChecks, showItemIcons,
    title, titlePrefix, titleIcon, titleVisuallyHidden,
    dataTest, dataTestId, ariaLabelledBy,
  } = props;

  const triggerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // The header is itself part of its own accessible name (see aria-labelledby below, which
  // references this id alongside the caller's label id) - its text content is the chosen value.
  const headerId = useId();

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

  // useDropdown's own onKeyDown closes the whole list on Escape but never calls
  // stopPropagation(). When the list lives inside a React Aria Popover (e.g. the WaveRunner date
  // picker's month/station/model lists), the unstopped Escape keeps bubbling and also dismisses
  // the popover, discarding whatever the student was in the middle of picking. Run the hook's
  // handler first so its own behavior (closing this list, returning focus) is unaffected, then
  // stop Escape from propagating any further; every other key passes through untouched.
  const handleListKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    dropdown?.listProps?.onKeyDown?.(e);
    if (e.key === "Escape") {
      e.stopPropagation();
    }
  }, [dropdown]);

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
        id={headerId}
        className={`header ${showListClass} ${disabledClass}`}
        data-test={getDataTest("header")}
        data-testid={getDataTestIdValue("header")}
        aria-labelledby={ariaLabelledBy ? `${ariaLabelledBy} ${headerId}` : undefined}
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
          onKeyDown={handleListKeyDown}
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
                // useDropdown's getItemProps sets aria-selected on whichever item has the
                // keyboard cursor (activeIndex), not on the item the student actually chose - so
                // every option a screen reader user arrows past is announced as "selected", and
                // (see useDropdown's open effect, which looks for aria-selected="true" in the DOM
                // to decide where to focus on open) nothing carries the attribute until a key is
                // pressed, so opening the list always focuses item 0 instead of the chosen one.
                // Overriding it here, after the spread, with the real selection fixes both: screen
                // readers announce the right option, and the hook's open effect finds it and
                // focuses it instead of defaulting to the first item.
                aria-selected={selected === item.text ? true : undefined}
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
