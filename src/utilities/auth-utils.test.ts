import { convertURLToOAuth2 } from "./auth-utils";

describe("auth-utils", () => {
  describe("convertURLToOAuth2", () => {
    it("handles a student url", () => {
      const studentURL = "https://collaborative-learning.concord.org/branch/master/?unit=msa&problem=1.4&token=16c1c896e36d24eeb329508142bc6312&domain=https://learn.portal.staging.concord.org/&domain_uid=114";
      const newURL = convertURLToOAuth2(studentURL, "https://example.com/", "123");
      expect(newURL?.toString()).toBe("https://collaborative-learning.concord.org/branch/master/?unit=msa&problem=1.4&domain=https%3A%2F%2Flearn.portal.staging.concord.org%2F&domain_uid=114&authDomain=https%3A%2F%2Fexample.com&resourceLinkId=123");
    });
    it("handles a teacher url", () => {
      const teacherURL = "https://collaborative-learning.concord.org/branch/master/?class=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fclasses%2F111&classOfferings=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%3Fclass_id%3D111&logging=true&offering=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%2F112&reportType=offering&token=a4ebf7f5aae51671a6b7081abfd1adb0&username=google-118170338932514291325";
      const newURL = convertURLToOAuth2(teacherURL, "https://example.com/", "123");
      expect(newURL?.toString()).toBe("https://collaborative-learning.concord.org/branch/master/?class=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fclasses%2F111&classOfferings=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%3Fclass_id%3D111&logging=true&offering=https%3A%2F%2Flearn.portal.staging.concord.org%2Fapi%2Fv1%2Fofferings%2F112&reportType=offering&username=google-118170338932514291325&authDomain=https%3A%2F%2Fexample.com&resourceLinkId=123");
    });
    it("handles a student url without a slash in the portal URL", () => {
      const studentURL = "https://collaborative-learning.concord.org/branch/master/?unit=msa&problem=1.4&token=16c1c896e36d24eeb329508142bc6312&domain=https://learn.portal.staging.concord.org/&domain_uid=114";
      const newURL = convertURLToOAuth2(studentURL, "https://example.com", "123");
      expect(newURL?.toString()).toBe("https://collaborative-learning.concord.org/branch/master/?unit=msa&problem=1.4&domain=https%3A%2F%2Flearn.portal.staging.concord.org%2F&domain_uid=114&authDomain=https%3A%2F%2Fexample.com&resourceLinkId=123");
    });
    it("handles a student url that already has the OAuth2 parameters", () => {
      const studentURL = "https://collaborative-learning.concord.org/branch/master/?unit=msa&problem=1.4&domain=https%3A%2F%2Flearn.portal.staging.concord.org%2F&domain_uid=114&authDomain=https%3A%2F%2Fexample.com&resourceLinkId=123";
      const newURL = convertURLToOAuth2(studentURL, "https://example.com", "123");
      expect(newURL?.toString()).toBeUndefined();
    });
  });
});
