import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";

import { configure, mount } from "enzyme";
import { DemoCreatorComponment } from "./demo-creator";
import { createStores, IStores } from "../../models/stores/stores";
import { DemoModel } from "../../models/stores/demo";
import { UnitModel } from "../../models/curriculum/unit";

const demoUnitJson = {
  code: "test",
  title: "Demo Creator Test",
  abbrevTitle: "Test",
  subtitle: "",
  investigations: [
    {
      description: "Demo Creator Investigation",
      ordinal: 1,
      title: "Demo Creator Test",
      introduction: {
        tiles: [ ]
      },
      problems: [
        {
          description: "Demo Creator Problem",
          ordinal: 1,
          title: "Demo Creator Test",
          subtitle: "",
          sections: [
            {
              type: "introduction",
              content: {
                tiles: [
                ]
              }
            }
          ]
        }
      ]
    }
  ]
};

configure({ adapter: new Adapter() });

describe("DemoCreator Component", () => {
  let stores: IStores;

  beforeEach(() => {
    stores = createStores({
      demo: DemoModel.create({
        class: {
          id: "1",
          name: "Test Class"
        }
      }),
      unit: UnitModel.create(demoUnitJson)
    });
  });

  it("can render", () => {
    const wrapper = mount(<DemoCreatorComponment stores={stores} />);
    expect(wrapper.contains(<h1>Demo Creator</h1>)).toEqual(true);

    // test changing classes
    expect(wrapper.find("ul.student-links").first().contains(
      // tslint:disable-next-line:max-line-length
      <a href="?appMode=demo&amp;fakeClass=1&amp;fakeUser=student:1&amp;unit=test&amp;problem=1.1" target="_blank">student 1</a>
    )).toBe(true);
    wrapper.find("select.classes").simulate("change", {target: {value: 2}});
    expect(wrapper.find("ul.student-links").first().contains(
      // tslint:disable-next-line:max-line-length
      <a href="?appMode=demo&amp;fakeClass=2&amp;fakeUser=student:1&amp;unit=test&amp;problem=1.1" target="_blank">student 1</a>
    )).toBe(true);

    // test changing classes
    wrapper.find("select.problems").simulate("change", {target: {value: "1.2"}});
    expect(wrapper.find("ul.student-links").first().contains(
      // tslint:disable-next-line:max-line-length
      <a href="?appMode=demo&amp;fakeClass=2&amp;fakeUser=student:1&amp;unit=test&amp;problem=1.2" target="_blank">student 1</a>
    )).toBe(true);
  });
});
