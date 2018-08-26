import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";

import { configure, shallow } from "enzyme";

import { expect } from "chai";
import { LeftNavComponent } from "../../src/components/left-nav";

configure({ adapter: new Adapter() });

context("Tests", () => {
  it("TypeScript works", () => {
    const x: number = 42;
  });

  it("Shallow renders work", () => {
    const comp = shallow(<LeftNavComponent />);
    expect(comp.text()).to.equal("Left Nav");
  });
});
