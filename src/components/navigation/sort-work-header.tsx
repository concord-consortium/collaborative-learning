import { observer } from "mobx-react";
import React from "react";
import { CustomSelect, ICustomDropdownItem } from "../../clue/components/custom-select";

import "./sort-work-header.scss";

interface ISortHeaderProps{
  docFilter: string;
  docFilterItems: ICustomDropdownItem[];
  primarySort: string;
  primarySortItems: ICustomDropdownItem[];
  secondarySort: string;
  secondarySortItems: ICustomDropdownItem[];
}

export const SortWorkHeader:React.FC<ISortHeaderProps>= observer(function SortWorkView(props){
  const { docFilter, docFilterItems, primarySort, primarySortItems, secondarySort, secondarySortItems } = props;
  return (
    <div className="sort-filter-menu-container">
      <div className="sort-work-header">
        <div className="header-text">Sort by</div>
        <div className="header-dropdown">
          <CustomSelect
            className="sort-work-sort-menu primary-sort-menu"
            dataTest="sort-work-sort-menu"
            title={primarySort}
            items={primarySortItems}
            showItemChecks={true}
          />
        </div>
        <div className="header-text secondary">then</div>
        <div className="header-dropdown">
          <CustomSelect
            className="sort-work-sort-menu secondary-sort-menu"
            dataTest="sort-work-sort-menu"
            title={secondarySort}
            items={secondarySortItems}
            showItemChecks={true}
          />
        </div>
      </div>
      <div className="filter-work-header">
        <div className="header-text">Show for</div>
        <div className="header-dropdown">
          <CustomSelect
            className="filter-work-menu primary-filter-menu"
            dataTest="filter-work-menu"
            title={docFilter}
            items={docFilterItems}
            showItemChecks={false}
          />
        </div>
      </div>
    </div>
  );
});
