import { observer } from "mobx-react";
import React from "react";
// import { CustomSelect } from "/clue/components/custom-select";
import { CustomSelect, ICustomDropdownItem } from "../../clue/components/custom-select";

import "./sort-work-header-dropdown.scss";

interface ISortHeaderProps{
  firstOptionItems: ICustomDropdownItem[];
  secondOptionItems: ICustomDropdownItem[];
  selectedOptions: string[];
}

export const SortWorkHeader:React.FC<ISortHeaderProps>= observer(function SortWorkView(
  {firstOptionItems, secondOptionItems, selectedOptions}
){
  return (
    <div className="sort-work-header">
      <div className="header-text">Sort by</div>
      <div className="header-dropdown">
        <CustomSelect
          className="sort-work-header-menu"
          dataTest="sort-work-header-menu"
          title={selectedOptions[0]}
          items={firstOptionItems}
          showItemChecks={true}
        />
      </div>
      <div className="header-dropdown option-two">
        <CustomSelect
          className="sort-work-header-menu"
          dataTest="sort-work-header-menu"
          title={selectedOptions[1]}
          items={secondOptionItems}
          showItemChecks={true}
        />
      </div>

    </div>

  );
});
