import { DataSetLinkButton } from "../../components/toolbar/data-set-link-button";
import { DataSetViewButton } from "../../components/toolbar/data-set-view-button";
import { registerTileToolbarButtons }
  from "../../components/toolbar/toolbar-button-manager";


registerTileToolbarButtons('dataflow',
[
  {
    // Immediate view. Takes an argument saying what kind of tile it should create.
    name: "data-set-view",
    component: DataSetViewButton
  },
  {
    // Dialog-mediated view. Also takes an argument for tile type.
    name: "data-set-link",
    component: DataSetLinkButton
  }
]);
