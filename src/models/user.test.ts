import { expect } from "chai";
import { UserModel } from "./user";

describe("user model", () => {

  it("sets default values", () => {
    const user = UserModel.create({});
    expect(user.authenticated).to.equal(false);
    expect(user.name).to.equal(null);
  });

  it("uses override values", () => {
    const user = UserModel.create({
        authenticated: true,
        name: "Test User",
    });
    expect(user.authenticated).to.equal(true);
    expect(user.name).to.equal("Test User");
  });

  it("can change its name", () => {
    const user = UserModel.create({
        name: "Test User",
    });
    expect(user.name).to.equal("Test User");
    user.setName("Different User");
    expect(user.name).to.equal("Different User");
  });
});
