import {
  isValidHttpUrl, getUnitCodeFromUrl, getUnitCodeFromUnitParam, getUrlFromRelativeOrFullString
} from './url-utils';

describe("isValidHttpUrl", () => {
  const validUrl = "https://concord.org";
  const invalidUrl = "https/concord/org";

  it("returns true for valid urls", () => {
    const isValidUrlValid = isValidHttpUrl(validUrl);
    expect(isValidUrlValid).toBe(true);
  });
  it("returns false for invalid urls", () => {
    const isInvalidUrlValid = isValidHttpUrl(invalidUrl);
    expect(isInvalidUrlValid).toBe(false);
  });
});

describe("getUnitCodeFromUrl", () => {
  it("returns unitcode", () => {
    const urlWithUnitCode = "https://concord.org/curriculum/unitcode/content.json";
    const unitCode = getUnitCodeFromUrl(urlWithUnitCode);
    expect(unitCode).toBe("unitcode");
  });
});

describe("getUnitCodeFromUnitParam", () => {
  it("returns unitcode", () => {
    expect(getUnitCodeFromUnitParam("https://concord.org/curriculum/unitcode/content.json"))
      .toBe("unitcode");
    expect(getUnitCodeFromUnitParam("http://localhost:8080/curriculum/unitcode/content.json"))
      .toBe("unitcode");
    expect(getUnitCodeFromUnitParam("https://concord.org/branch/test/curriculum/unitcode/content.json"))
      .toBe("unitcode");
    expect(getUnitCodeFromUnitParam("unitcode"))
      .toBe("unitcode");
    // This kind of unit param produces a weird unit code, however this
    // function is just used to create a fake offering id, so weird codes
    // are OK
    expect(getUnitCodeFromUnitParam("https://concord.org/content.json"))
      .toBe("concord.org");

    // This is also a weird unit code, but again it shouldn't be that important
    expect(getUnitCodeFromUnitParam("./content.json"))
    .toBe(".");
  });
});

describe("getUrlFromRelativeOrFullString", () => {
  // In Jest 30/jsdom, use jsdom's reconfigure method to change the URL
  const originalHref = window.location.href;

  const setLocation = (url: string) => {
    (global as any).jsdom.reconfigure({ url });
  };

  afterEach(() => {
    setLocation(originalHref);
  });

  const f = (param: string) => getUrlFromRelativeOrFullString(param)?.href;

  it("returns a URL when the param is a full URL", () => {
    expect(f("https://concord.org/curriculum/unitcode/content.json"))
      .toBe("https://concord.org/curriculum/unitcode/content.json");
    expect(f("http://concord.org/curriculum/unitcode/content.json"))
      .toBe("http://concord.org/curriculum/unitcode/content.json");
  });

  it("returns a URL with a base of window.location when the URL starts with './'", () => {
    setLocation("https://clue.concord.org");
    expect(f("./content.json"))
      .toBe("https://clue.concord.org/content.json");

    setLocation("http://localhost:8080/");
    expect(f("./content.json"))
      .toBe("http://localhost:8080/content.json");

    // TODO: We need to mock the _webpack_public_path_ for this
    // to work properly.
    // setLocation("http://localhost:8080/editor/");
    // expect(f("./content.json"))
    //   .toBe("http://localhost:8080/content.json");
  });

  it("returns undefined, when the URL is not full or starts with './'", () => {
    expect(f("content.json"))
      .toBeUndefined();
    expect(f("/content.json"))
      .toBeUndefined();
    expect(f("something/content.json"))
      .toBeUndefined();
  });
});
