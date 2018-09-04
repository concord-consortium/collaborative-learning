import { createStores } from "./stores";
import { ProblemModel } from "./problem";
import { UserModel } from "./user";

describe("stores object", () => {

  it("supports creating dummy stores for testing", () => {
    const stores = createStores();
    expect(stores).toBeDefined();
    expect(stores.user).toBeDefined();
    expect(stores.problem).toBeDefined();
    expect(stores.ui).toBeDefined();
  });

  it("supports passing in stores for testing", () => {
    const devMode = true;
    const name = "Colonel Mustard";
    const user = UserModel.create({ name });
    const title = "Test Problem";
    const problem = ProblemModel.create({ ordinal: 1, title });
    const stores = createStores({ devMode, user, problem });
    expect(stores.devMode).toBe(true);
    expect(stores.user.name).toBe(name);
    expect(stores.problem.title).toBe(title);
  });

});
