import { act, configure, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { DemoCreatorComponent, passThroughQueryItemsFromUrl } from "./demo-creator";
import { UnitModel } from "../../models/curriculum/unit";
import { specStores } from "../../models/stores/spec-stores";
import { IStores } from "../../models/stores/stores";
import { DemoModel } from "../../models/stores/demo";

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
          description: "Demo Creator Problem 1",
          ordinal: 1,
          title: "Demo Creator Test 1",
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
        },
        {
          description: "Demo Creator Problem 2",
          ordinal: 2,
          title: "Demo Creator Test 2",
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

configure({ testIdAttribute: "data-test" });

describe("DemoCreator Component", () => {
  let stores: IStores;

  beforeEach(() => {
    stores = specStores({
      demo: DemoModel.create({
        class: {
          id: "1",
          name: "Test Class"
        }
      }),
      unit: UnitModel.create(demoUnitJson)
    });
  });

  it("can render", async () => {
    render(<DemoCreatorComponent stores={stores} />);
    expect(screen.getAllByRole("heading")[0]).toHaveTextContent("Demo Creator");
  });

  it("can change classes and problems", () => {
    render(<DemoCreatorComponent stores={stores} />);

    // test changing classes
    expect(screen.getAllByRole("link")[0])
      .toHaveAttribute("href", "?appMode=demo&fakeClass=1&fakeUser=student:1&unit=test&problem=1.1");
    act(() => {
      userEvent.selectOptions(screen.getByTestId("class-select"), "2");
    });
    expect(screen.getAllByRole("link")[0])
      .toHaveAttribute("href", "?appMode=demo&fakeClass=2&fakeUser=student:1&unit=test&problem=1.1");

    // test changing problems
    act(() => {
      userEvent.selectOptions(screen.getByTestId("problem-select"), "1.2");
    });
    expect(screen.getAllByRole("link")[0])
      .toHaveAttribute("href", "?appMode=demo&fakeClass=2&fakeUser=student:1&unit=test&problem=1.2");
  });
});
