import { Firebase } from "./firebase";
import { UserModel } from "../models/stores/user";

describe("Firebase.getGroupUserActivityPath", () => {
  it("nests activity under the group user path", () => {
    const fb = new Firebase({} as any);
    const user = UserModel.create({
      id: "u1", classHash: "c1", offeringId: "off1"
    });
    expect(fb.getGroupUserActivityPath(user, "g1"))
      .toBe("classes/c1/offerings/off1/groups/g1/users/u1/activity");
    expect(fb.getGroupUserActivityPath(user, "g1", "u2"))
      .toBe("classes/c1/offerings/off1/groups/g1/users/u2/activity");
  });
});
