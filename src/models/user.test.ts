import { UserModel } from "./user";

describe("user model", () => {

  it("sets default values", () => {
    const user = UserModel.create({});
    expect(user.authenticated).toBe(false);
    expect(user.name).toBe("Anonymous User");
  });

  it("uses override values", () => {
    const user = UserModel.create({
        authenticated: true,
        name: "Test User",
    });
    expect(user.authenticated).toBe(true);
    expect(user.name).toBe("Test User");
  });

  it("can change its name", () => {
    const user = UserModel.create({
        name: "Test User",
    });
    expect(user.name).toBe("Test User");
    user.setName("Different User");
    expect(user.name).toBe("Different User");
  });

  it("can authenticate", () => {
    const user = UserModel.create();
    user.setAuthentication(true);
    expect(user.authenticated).toBe(true);
  });

  it("can set a class name", () => {
    const user = UserModel.create();
    const className = "test class";
    user.setClassName(className);
    expect(user.className).toBe(className);
  });
});
