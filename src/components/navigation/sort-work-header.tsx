import { observer } from "mobx-react";
import React from "react";
import { CustomSelect } from "../../clue/components/custom-select";

import "./sort-work-header-dropdown.scss";

interface ISortHeaderProps{
  sortBy: string;
  sortByOptions: any[]
}

export const SortWorkHeader:React.FC<ISortHeaderProps>= observer(function SortWorkView({sortBy, sortByOptions}){
  return (
    <div className="sort-work-header">
      <div className="header-text">Sort by</div>
      <div className="header-dropdown">
        <CustomSelect
          className="sort-work-sort-menu"
          dataTest="sort-work-sort-menu"
          title={sortBy}
          items={sortByOptions}
          showItemChecks={true}
        />
      </div>
    </div>
  );
});
