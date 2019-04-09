
import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";
import { mount, configure } from "enzyme";
import { createStores } from "../../models/stores/stores";
import { ControlPanelComponent } from "./control-panel";
import { Provider } from "mobx-react";

configure({ adapter: new Adapter() });
describe("DataFlow Control Panel Component", () => {
  it("renders basic components", () => {
    const stores = createStores({});
    const wrapper = mount(
      <Provider stores={stores}>
        <ControlPanelComponent />
      </Provider>
    );
    expect(wrapper.find(ControlPanelComponent).length).toEqual(1);
  });
});
