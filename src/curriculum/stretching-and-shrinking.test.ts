import { assert } from "chai";
import { createFromJson } from "../models/curriculum";
import * as curriculumJson from "./stretching-and-shrinking.json";

describe("stretching and shrinking sample curriculum module", () => {

  it("reads successfully", () => {
    const curriculum = createFromJson(curriculumJson);
    assert(curriculum != null);
  });

});
