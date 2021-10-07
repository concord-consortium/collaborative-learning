import Adapter from "enzyme-adapter-react-16";
import React from "react";

import { configure, mount } from "enzyme";
import { DemoCreatorComponent, passThroughQueryItemsFromUrl } from "./demo-creator";
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


test("Pass-Through Parameters being missing yields an empty string", () => {
  const href = "http://b.cc:8080/";
  expect(passThroughQueryItemsFromUrl(href)).toEqual("");
});

test("Pass-Through Parameters ONLY being in the exclude list yields an empty string", () => {
  const href = "http://b.cc:8080/?demo&fakeUser=JimAbbott&problem=NaN";
  expect(passThroughQueryItemsFromUrl(href)).toEqual("");
});

test("Pass-Through Parameters NOT being in the exclude list yields a (pre-pended) query string", () => {
  const href = "http://b.cc:8080/?passValuelessKey&passKeyPlusValue=myvalue";
  expect(passThroughQueryItemsFromUrl(href)).toEqual("&passKeyPlusValue=myvalue&passValuelessKey");
});

test("Mix of excluded/OK params yields a (pre-pended) query string with only OK ones", () => {
  const href = "http://b.cc:8080/?passKeyPlusValue=fred&unit";
  expect(passThroughQueryItemsFromUrl(href)).toEqual("&passKeyPlusValue=fred");
});


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
    const wrapper = mount(<DemoCreatorComponent stores={stores} />);
    expect(wrapper.contains(<h1>Demo Creator</h1>)).toEqual(true);

    // test changing classes
    expect(wrapper.find("ul.student-links").first().contains(
      // eslint-disable-next-line max-len
      <a href="?appMode=demo&amp;fakeClass=1&amp;fakeUser=student:1&amp;unit=test&amp;problem=1.1" target="_blank" rel="noreferrer">student 1</a>
    )).toBe(true);
    wrapper.find("select.classes").simulate("change", {target: {value: 2}});
    expect(wrapper.find("ul.student-links").first().contains(
      // eslint-disable-next-line max-len
      <a href="?appMode=demo&amp;fakeClass=2&amp;fakeUser=student:1&amp;unit=test&amp;problem=1.1" target="_blank" rel="noreferrer">student 1</a>
    )).toBe(true);

    // test changing classes
    wrapper.find("select.problems").simulate("change", {target: {value: "1.2"}});
    expect(wrapper.find("ul.student-links").first().contains(
      // eslint-disable-next-line max-len
      <a href="?appMode=demo&amp;fakeClass=2&amp;fakeUser=student:1&amp;unit=test&amp;problem=1.2" target="_blank" rel="noreferrer">student 1</a>
    )).toBe(true);
  });
});
