import * as Adapter from "enzyme-adapter-react-16";
import * as React from "react";
import { mount, configure} from "enzyme";
import { ClassMenu , IMenuUser} from "./class-menu";

configure({ adapter: new Adapter() });

const link = "http://testclass.com/foo.html";
const className = "TestClass";

const menuUser: IMenuUser = {
  className,
  portalClasses: [
    {
      className,
      link
    }
  ]
};

describe("<ClassMenu />", () => {
  it("should render the ClassName", () => {
    const wrapper = mount(<ClassMenu user={ menuUser } />);
    expect(wrapper.contains("TestClass")).toBe(true);
  });
  it("should render the ClassLink", () => {
    const wrapper = mount(<ClassMenu user={ menuUser } />);
    wrapper.find("button").simulate("click");
    expect(wrapper.contains(link)).toBe(true);
  });
});
