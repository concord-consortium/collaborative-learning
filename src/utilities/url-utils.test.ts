import { isValidHttpUrl, getUnitCodeFromUrl, getCurriculumBranchFromUrl } from './url-utils';

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
  const urlWithUnitCode = "https://concord.org/curriculum/unitcode/content.json";
  const unitCode = getUnitCodeFromUrl(urlWithUnitCode);
  expect(unitCode).toBe("unitcode");
});

describe("getCurriculumBranchFromUrl", () => {
  const urlWithBranch = "https://concord.org/curriculum/branch/branch-name/unitcode/content.json";
  const branch = getCurriculumBranchFromUrl(urlWithBranch);
  expect(branch).toBe("branch-name");
});
