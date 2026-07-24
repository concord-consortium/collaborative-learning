import { observer } from "mobx-react";
import React from "react";
import { useResizeDetector } from "react-resize-detector";
import { CustomSelect, ICustomDropdownItem } from "../../clue/components/custom-select";

import "./sort-work-header.scss";

// Below this width the "Sort by / then / Show for" row overflows a narrow resources pane (e.g. the
// wideContent layout, or any layout with comments open) and clips the filter menu. When the header is
// narrower than this we drop the secondary "then" sort so the remaining fields fit.
const kMinWidthForSecondarySort = 620;

interface ISortHeaderProps{
  docFilterItems: ICustomDropdownItem[];
  primarySortItems: ICustomDropdownItem[];
  secondarySortItems: ICustomDropdownItem[];
  showContextFilter?: boolean;
}

export const SortWorkHeader:React.FC<ISortHeaderProps>= observer(function SortWorkView(props){
  const { docFilterItems, primarySortItems, secondarySortItems, showContextFilter = true } = props;
  const { width, ref } = useResizeDetector<HTMLDivElement>();
  // Show the secondary sort until we've measured a width that's too narrow to fit all fields.
  const showSecondarySort = width == null || width >= kMinWidthForSecondarySort;
  return (
    <div className="sort-filter-menu-container" ref={ref}>
      <div className="sort-work-header">
        <div className="header-text">Sort by</div>
        <div className="header-dropdown">
          <CustomSelect
            className="sort-work-sort-menu primary-sort-menu"
            dataTest="sort-work-sort-menu"
            items={primarySortItems}
            showItemChecks={true}
          />
        </div>
        {showSecondarySort && (
          <>
            <div className="header-text secondary">then</div>
            <div className="header-dropdown">
              <CustomSelect
                className="sort-work-sort-menu secondary-sort-menu"
                dataTest="sort-work-sort-menu"
                items={secondarySortItems}
                showItemChecks={true}
              />
            </div>
          </>
        )}
      </div>
      {showContextFilter && (
        <div className="filter-work-header">
          <div className="header-text">Show for</div>
          <div className="header-dropdown">
            <CustomSelect
              className="filter-work-menu primary-filter-menu"
              dataTest="filter-work-menu"
              items={docFilterItems}
              showItemChecks={false}
            />
          </div>
        </div>
      )}
    </div>
  );
});
