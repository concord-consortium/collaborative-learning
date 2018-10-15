import { SupportModel } from "./support";

describe("support model", () => {

  it("uses override values", () => {
    const support = SupportModel.create({
      text: "Did you try turning it on and off?"
    });
    expect(support).toEqual({
      text: "Did you try turning it on and off?"
    });
  });
});
