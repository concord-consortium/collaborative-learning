import { expect } from "chai"
import { ProblemModel } from "./problem"

describe("problem model", () => {

  it("uses override values", () => {
    const problem = ProblemModel.create({
        name: "Test Problem"
    })
    expect(problem.name).to.equal("Test Problem")
  })

});
