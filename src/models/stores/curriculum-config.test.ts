import { CurriculumConfig, ICurriculumConfigSnapshot, getProblemOrdinal } from "./curriculum-config";

function getConfig(overrides?: Partial<ICurriculumConfigSnapshot>) {
  return CurriculumConfig.create({
    curriculumSiteUrl: "https://curriculum.example.com",
    ...overrides
  });
}

describe("CurriculumConfig", () => {
  it("can get URLs for remote curriculum content from a unit code", () => {
    const config = getConfig();
    const exampleUnitCode = "example-unit-code";
    const exampleUnit = {
      "content": `https://curriculum.example.com/branch/main/${exampleUnitCode}/content.json`,
      "guide": `https://curriculum.example.com/branch/main/${exampleUnitCode}/teacher-guide/content.json`
    };
    expect(config.getUnit(exampleUnitCode)).toStrictEqual(exampleUnit);
    expect(config.getUnitBasePath(exampleUnitCode)).toBe(exampleUnitCode);
  });

  it("can get URLs for remote curriculum content from a unit URL", () => {
    const config = getConfig();
    const exampleUnitUrl = "https://concord.org/content.json";
    const exampleUnit = {
      "content": "https://concord.org/content.json",
      "guide": "https://concord.org/teacher-guide/content.json"
    };
    expect(config.getUnit(exampleUnitUrl)).toStrictEqual(exampleUnit);
    // FIXME: This is probably a bug because this base path is used to compute the location of some images
    // by tacking on an /images/... to this base path.
    // With the current code it means the computed URL would be something like:
    //   https://concord.org/content.json/images/...
    expect(config.getUnitBasePath(exampleUnitUrl)).toBe(exampleUnitUrl);
  });

  it("can return unit code variants", () => {
    const config = getConfig({
      unitCodeMap: { foo: "bar", bam: "bar", baz: "qux" }
    });
    expect(config.getUnitCodeVariants("bar")).toEqual(["bar", "foo", "bam"]);
    expect(config.getUnitCodeVariants("qux")).toEqual(["qux", "baz"]);
    expect(config.getUnitCodeVariants("unknown")).toEqual(["unknown"]);
  });
});

describe("PortalOfferingParser", () => {

  // TODO: All we need here is the url so we can drop this offering stuff
  const samplePortalOffering = {
    id: 1190,
    teacher: "Dave Love",
    clazz: "ClueClass1",
    clazz_id: 242,
    activity: "CLUE 1.2: Stretching a Figure - Comparing Similar Figures",
    activity_url: "https://collaborative-learning.concord.org/branch/master/?problem=1.2&unit=foo"
  };

  describe("getProblemOrdinal", () => {
    it("should return a problemOrdinal", () => {
      const ordinal = getProblemOrdinal(samplePortalOffering.activity_url);
      expect(ordinal).toEqual("1.2");
    });
  });

  describe("getUnitCode", () => {
    it("should return a unit code for problem", () => {
      const config = getConfig();
      const unitCode = config.getUnitCode(samplePortalOffering.activity_url);
      expect(unitCode).toEqual("foo");
    });

    it("should return a mapped unit code for legacy units", () => {
      const mappedConfig = getConfig({
        unitCodeMap: { foo: "bar" }
      });
      const unitCode = mappedConfig.getUnitCode(samplePortalOffering.activity_url);
      expect(unitCode).toEqual("bar");
    });
  });
});

describe("PortalOfferingParserWithDefaults", () => {

  const samplePortalOffering = {
    id: 1190,
    teacher: "Dave Love",
    clazz: "ClueClass1",
    clazz_id: 242,
    activity: "CLUE 1.2: Stretching a Figure - Comparing Similar Figures",
    activity_url: "https://collaborative-learning.concord.org/branch/master/"
  };

  describe("getProblemOrdinal", () => {
    it(`should default to 'undefined'`, () => {
      const ordinal = getProblemOrdinal(samplePortalOffering.activity_url);
      expect(ordinal).toBeUndefined();
    });
  });

  describe("getUnitCode", () => {
    const config = getConfig();
    it(`should default to 'undefined'`, () => {
      const unitCode = config.getUnitCode(samplePortalOffering.activity_url);
      expect(unitCode).toBeUndefined();
    });
  });
});
