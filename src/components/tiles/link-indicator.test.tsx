import React from "react";
import { render } from "@testing-library/react";
import { LinkIndicatorComponent } from "./link-indicator";

describe("LinkIndicator Component", () => {

  it("renders successfully", () => {
    const { container } = render(<LinkIndicatorComponent id="test" index={0} />);
    expect(container.querySelector(".link-indicator")).toBeDefined();
    expect(container.querySelector(".link-indicator svg")).toBeDefined();
  });
});
