import { createStores, AppMode } from "./stores";
import { ProblemModel } from "../curriculum/problem";
import { AppConfigModel } from "./app-config-model";
import { UserModel } from "./user";
import { DB } from "../../lib/db";

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
    const appConfig = AppConfigModel.create({ defaultUnit: "foo" });
    const appMode: AppMode = "dev";
    const id = "1";
    const name = "Colonel Mustard";
    const type = "student";
    const user = UserModel.create({ id, type, name });
    const title = "Test Problem";
    const problem = ProblemModel.create({ ordinal: 1, title });
    const db = new DB();
    const stores = createStores({ appConfig, appMode, user, problem, db });
    expect(stores.appConfig.defaultUnit).toBe("foo");
    expect(stores.appMode).toBe("dev");
    expect(stores.user.id).toBe(id);
    expect(stores.user.type).toBe(type);
    expect(stores.user.name).toBe(name);
    expect(stores.problem.title).toBe(title);
    expect(stores.db).toBe(db);
  });

});
