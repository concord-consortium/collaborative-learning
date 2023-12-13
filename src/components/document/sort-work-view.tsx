import { observer } from "mobx-react";
import React from "react";

export const SortWorkView:React.FC = observer(function SortWorkView(){
  return (
    <div key="sort-work-view">
      get some work and make it sortable!
    </div>
  );
});
