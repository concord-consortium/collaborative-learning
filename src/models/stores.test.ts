import { createStores, AppMode } from "./stores";
import { ProblemModel } from "./curriculum/problem";
import { UserModel } from "./user";
import { DB } from "../lib/db";

describe("stores object", () => {

  it("supports creating dummy stores for testing", () => {
    const stores = createStores();
    expect(stores).toBeDefined();
    expect(stores.user).toBeDefined();
    expect(stores.problem).toBeDefined();
    expect(stores.ui).toBeDefined();
    expect(stores.db).toBeDefined();
  });

  it("supports passing in stores for testing", () => {
    const appMode: AppMode = "dev";
    const name = "Colonel Mustard";
    const user = UserModel.create({ name });
    const title = "Test Problem";
    const problem = ProblemModel.create({ ordinal: 1, title });
    const db = new DB();
    const stores = createStores({ appMode, user, problem, db });
    expect(stores.appMode).toBe("dev");
    expect(stores.user.name).toBe(name);
    expect(stores.problem.title).toBe(title);
    expect(stores.db).toBe(db);
  });

});
