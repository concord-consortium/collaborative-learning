import * as React from "react";
import { observer, inject } from "mobx-react";
import { BaseComponent } from "../../base";
import { ToolTileModelType } from "../../../models/tools/tool-tile";
import { SectionType } from "../../../models/curriculum/section";

import "./placeholder-tool.sass";

interface IProps {
  model: ToolTileModelType;
}

@inject("stores")
@observer
export default class PlaceholderToolComponent extends BaseComponent<IProps, {}> {
  // WTD leave this in for now so we can delete test tiles, but eventually
  // we might want to make it so the tile cannot be selected and deleted
  public static tileHandlesSelection = true;

  public render() {
    const classes = `placeholder-tool`;
    return (
      <div>
        <div className={classes}>
          <div>
            Create or drag files here
          </div>
        </div>

      </div>
    );
  }
}
