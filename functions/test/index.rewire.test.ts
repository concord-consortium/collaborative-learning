// https://weekly.elfitz.com/2018/10/17/using-rewire-with-typescript-jest/
const rewire = require("rewire");
// https://weekly.elfitz.com/2018/10/17/using-rewire-with-typescript-jest/
// https://github.com/kulshekhar/ts-jest/issues/1029#issuecomment-610284927
const index = rewire("../src/index.ts");

describe("getImageData", () => {

  describe("processGetImageDataParams", () => {
    const fn = index.__get__("processGetImageDataParams");
    const validAuthData = {
            appMode: "authed",
            portal: "testportal",
            classHash: "classhash",
            classPath: "/authed/portals/testportal/classes/classhash",
            type: "supportPublication",
            key: "supportKey"
          };
    const validDemoData = {
            appMode: "demo",
            portal: "testportal",
            classHash: "classhash",
            classPath: "/demo/portals/testportal/classes/classhash",
            type: "supportPublication",
            key: "supportKey"
          };
    const sneakyAuthData = {
            appMode: "demo",
            portal: "testportal",
            classHash: "classhash",
            classPath: "/authed/portals/testportal/classes/classhash",
            type: "supportPublication",
            key: "supportKey"
          };
    const contextWithClaims = {
            auth: {
              token: {
                platform_id: "testportal",
                class_hash: "classhash"
              }
            }
          };

    it("should validate mode", () => {
      expect(fn({ classPath: "" }, {}).isValidMode).toBe(false);
      expect(fn({ appMode: "foo", classPath: "/foo" }, {}).isValidMode).toBe(false);
      expect(fn({ appMode: "dev", classPath: "/dev" }, {}).isValidMode).toBe(true);
      expect(fn({ appMode: "demo", classPath: "/demo" }, {}).isValidMode).toBe(true);
      expect(fn({ appMode: "qa", classPath: "/qa" }, {}).isValidMode).toBe(true);
      expect(fn({ appMode: "test", classPath: "/test" }, {}).isValidMode).toBe(true);
      expect(fn({ appMode: "authed", classPath: "/authed" }, {}).isValidMode).toBe(false);
      expect(fn(validAuthData, contextWithClaims).isValidMode).toBe(true);
      expect(fn(validDemoData, {}).isValidMode).toBe(true);
      expect(fn(sneakyAuthData, {}).isValidMode).toBe(false);
    });

    it("should validate claims", () => {
      expect(fn({ classPath: "" }, {}).hasValidClaims).toBe(false);
      expect(fn({ appMode: "authed", classPath: "/authed" }, {}).hasValidClaims).toBe(false);
      expect(fn(validAuthData, contextWithClaims).hasValidClaims).toBe(true);
      expect(fn(validDemoData, {}).hasValidClaims).toBe(false);
      expect(fn(sneakyAuthData, {}).hasValidClaims).toBe(false);
    });

    it("should validate supportPath", () => {
      expect(fn({ classPath: "" }, {}).supportPath).toBe(undefined);
      expect(fn(validAuthData, contextWithClaims).supportPath).toBe("/authed/testportal/mcsupports/supportKey");
      const { classHash, ...authDataWithoutClassHash } = validAuthData;
      expect(fn(authDataWithoutClassHash, contextWithClaims).supportPath).toBe(undefined);
      const { type, ...authDataWithoutType } = validAuthData;
      expect(fn(authDataWithoutType, contextWithClaims).supportPath).toBe(undefined);
      const { key, ...authDataWithoutKey } = validAuthData;
      expect(fn(authDataWithoutKey, contextWithClaims).supportPath).toBe(undefined);
      expect(fn(validDemoData, {}).supportPath).toBe("/demo/testportal/mcsupports/supportKey");
      expect(fn(sneakyAuthData, {}).supportPath).toBe(undefined);
    });
  });

  describe("getImagePath", () => {
    const fn = index.__get__("getImagePath");
    const imageUrl = "ccimg://fbrtdb.concord.org/imagekey";
    const classPathParts = "/authed/portals/testportal/classes/classhash".split("/");
    it("should construct valid image paths", () => {
      expect(fn(imageUrl, classPathParts)).toBe("/authed/portals/testportal/classes/classhash/images/imagekey");
    });
  });
});
