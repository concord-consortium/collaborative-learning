import { buildSectionPath, escapeKey, getCurriculumMetadata, getSimpleDocumentPath, isProblemPath, isSectionPath,
  networkDocumentKey, parseProblemPath, parseSectionPath } from "./shared";

describe("shared types and utilities", () => {

  describe("escapeKey", () => {

    it("should escape the appropriate characters", () => {
      expect(escapeKey(".$[]#/")).toBe("______");

      const kNormalChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@%^&*()-_=+";
      expect(escapeKey(kNormalChars)).toBe(kNormalChars);
    });
  });

  describe("isProblemPath", () => {
    it("should discriminate problem paths correctly", () => {
      expect(isProblemPath()).toBe(false);
      expect(isProblemPath("")).toBe(false);
      expect(isProblemPath("foo")).toBe(false);
      expect(isProblemPath("foo/bar")).toBe(false);
      expect(isProblemPath("foo/1")).toBe(false);
      expect(isProblemPath("foo/bar/1")).toBe(false);
      expect(isProblemPath("foo/1/2")).toBe(true);
    });
  });

  describe("parseProblemPath", () => {
    it("should parse valid problem paths and reject invalid paths", () => {
      expect(parseProblemPath()).toBeUndefined();
      expect(parseProblemPath("")).toBeUndefined();
      expect(parseProblemPath("foo")).toBeUndefined();
      expect(parseProblemPath("foo/bar")).toBeUndefined();
      expect(parseProblemPath("foo/1")).toBeUndefined();
      expect(parseProblemPath("foo/bar/1")).toBeUndefined();
      expect(parseProblemPath("foo/1/2")).toEqual(["foo", "1", "2"]);
    });
  });

  describe("isSectionPath", () => {
    it("should discriminate section paths correctly", () => {
      expect(isSectionPath()).toBe(false);
      expect(isSectionPath("")).toBe(false);
      expect(isSectionPath("foo")).toBe(false);
      expect(isSectionPath("foo/bar")).toBe(false);
      expect(isSectionPath("foo/1")).toBe(false);
      expect(isSectionPath("foo/bar/1")).toBe(false);
      expect(isSectionPath("foo/1/2")).toBe(false);
      expect(isSectionPath("foo/1/2/intro")).toBe(true);
      expect(isSectionPath("foo:facet/1/2/intro")).toBe(true);
    });
  });

  describe("parseSectionPath", () => {
    it("should parse valid section paths and reject invalid paths", () => {
      expect(parseSectionPath()).toBeUndefined();
      expect(parseSectionPath("")).toBeUndefined();
      expect(parseSectionPath("foo")).toBeUndefined();
      expect(parseSectionPath("foo/bar")).toBeUndefined();
      expect(parseSectionPath("foo/1")).toBeUndefined();
      expect(parseSectionPath("foo/bar/1")).toBeUndefined();
      expect(parseSectionPath("foo/1/2")).toBeUndefined();
      expect(parseSectionPath("foo/1/2/intro")).toEqual(["foo", undefined, "1", "2", "intro"]);
      expect(parseSectionPath("foo:facet/1/2/intro")).toEqual(["foo", "facet", "1", "2", "intro"]);
    });
  });

  describe("buildSectionPath", () => {
    it("should build valid section paths and reject invalid problem paths", () => {
      expect(buildSectionPath("")).toBeUndefined();
      expect(buildSectionPath("foo")).toBeUndefined();
      expect(buildSectionPath("foo/bar")).toBeUndefined();
      expect(buildSectionPath("foo/1")).toBeUndefined();
      expect(buildSectionPath("foo/bar/1")).toBeUndefined();
      expect(buildSectionPath("foo/1/2")).toBe("foo/1/2");
      expect(buildSectionPath("foo/1/2", "intro")).toBe("foo/1/2/intro");
      expect(buildSectionPath("foo/1/2", undefined, "facet")).toBe("foo:facet/1/2");
      expect(buildSectionPath("foo/1/2", "intro", "facet")).toBe("foo:facet/1/2/intro");
      // maps full-length facets to abbreviated names where appropriate
      expect(buildSectionPath("foo/1/2", "intro", "teacher-guide")).toBe("foo:guide/1/2/intro");
    });
  });

  describe("getCurriculumMetadata", () => {
    it("should parse valid section paths and reject invalid paths", () => {
      expect(getCurriculumMetadata()).toBeUndefined();
      expect(getCurriculumMetadata("")).toBeUndefined();
      expect(getCurriculumMetadata("foo")).toBeUndefined();
      expect(getCurriculumMetadata("foo/bar")).toBeUndefined();
      expect(getCurriculumMetadata("foo/1")).toBeUndefined();
      expect(getCurriculumMetadata("foo/bar/1")).toBeUndefined();
      expect(getCurriculumMetadata("foo/1/2")).toBeUndefined();
      expect(getCurriculumMetadata("foo/1/2/intro"))
              .toEqual({ unit: "foo", problem: "1.2", section: "intro", path: "foo/1/2/intro" });
      expect(getCurriculumMetadata("foo:facet/1/2/intro"))
              .toEqual({ unit: "foo", facet: "facet", problem: "1.2", section: "intro", path: "foo:facet/1/2/intro" });
    });
  });

  describe("networkDocumentKey", () => {
    it("should return appropriate document key combining network and uid as appropriate", () => {
      expect(networkDocumentKey("user", "doc123")).toBe("uid:user_doc123");
      expect(networkDocumentKey("user", "doc123", "network")).toBe("network_doc123");
    });
  });

  describe("getSimpleDocumentPath", () => {
    it("returns curriculum path for section paths", () => {
      expect(getSimpleDocumentPath("msa/1/2/introduction")).toBe("curriculum/msa_1_2_introduction");
    });
    it("returns documents path for non-section paths", () => {
      expect(getSimpleDocumentPath("abc123")).toBe("documents/abc123");
    });
  });

});
