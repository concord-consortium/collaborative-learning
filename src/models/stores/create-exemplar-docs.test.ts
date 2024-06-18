import { createExemplarDocId } from "./create-exemplar-docs";

describe("Create Exemplar Docs", () => {
  describe("createExemplarDocId", () => {
    test("should encode disallowed characters", async () => {
      // We need to ensure that we don't create exemplar doc Ids with
      // characters that firebase disallows in keys [, ], #, $, ., /
      const result = createExemplarDocId("https://www.example.com/?thing=[1,2,3]$FOO#", "");
      expect(result).toBe("curriculum:https%3A%2F%2Fwww%2Eexample%2Ecom%2F%3Fthing%3D%5B1%2C2%2C3%5D%24FOO%23");
    });

    test("should strip curriculum base url", () => {
      const result = createExemplarDocId("https://www.example.com/curriculum/thing", "https://www.example.com/curriculum");
      expect(result).toBe("curriculum:%2Fthing");
    });
  });
});
