// import { render, screen } from "@testing-library/react";
// import { Provider } from "mobx-react";
// import React from "react";
// import { TileModel } from "../../../models/tiles/tile-model";
// import { TileModelContext } from "../../../components/tiles/tile-api";
// import { specStores } from "../../../models/stores/spec-stores";
// import { specAppConfig } from "../../../models/stores/spec-app-config";
// import { defaultTimelineContent } from "../models/timeline-content";
// import { TimelineComponent } from "./timeline-tile";

// // The timeline tile needs to be registered so the TileModel.create
// // knows it is a supported tile type
// import "../timeline-registration";

// describe("TimelineComponent", () => {
//   const content = defaultTimelineContent();
//   const model = TileModel.create({ content });

//   const defaultProps = {
//     tileElt: null,
//     context: "",
//     docId: "",
//     documentContent: null,
//     isUserResizable: true,
//     onResizeRow: () => { throw new Error("Function not implemented."); },
//     onSetCanAcceptDrop: () => { throw new Error("Function not implemented."); },
//     onRequestRowHeight: () => { throw new Error("Function not implemented."); },
//     onRegisterTileApi: () => { throw new Error("Function not implemented."); },
//     onUnregisterTileApi: () => { throw new Error("Function not implemented."); }
//   };

//   const stores = specStores({
//     appConfig: specAppConfig({
//       config: {
//         settings: {
//           "timeline": {
//             tools: ["table-it", "data-card-it", "bar-graph-it", "|", "zoom-in", "zoom-out", "view-all"]
//           }
//         }
//       }
//     })
//   });

//   function renderWithStores() {
//     stores.ui.setSelectedTileId(model.id);
//     return render(
//       <Provider stores={stores}>
//         <TileModelContext.Provider value={model}>
//           <TimelineComponent {...defaultProps} {...{model}} />
//         </TileModelContext.Provider>
//       </Provider>
//     );
//   }

//   it("renders successfully", () => {
//     const { container } = renderWithStores();
//     expect(container.querySelector(".timeline-tile")).toBeInTheDocument();
//   });

//   it("renders an editable tile title", () => {
//     const { container } = renderWithStores();
//     expect(container.querySelector(".title-area")).toBeInTheDocument();
//   });

//   it("renders all toolbar buttons", () => {
//     renderWithStores();
//     const toolbar = screen.getByTestId("tile-toolbar");
//     expect(toolbar).toContainHTML("Table It!");
//     expect(toolbar).toContainHTML("Data Card It!");
//     expect(toolbar).toContainHTML("Bar Graph It!");
//     expect(toolbar).toContainHTML("Zoom In");
//     expect(toolbar).toContainHTML("Zoom Out");
//     expect(toolbar).toContainHTML("View All");
//   });
// });
