import { convertURLToOAuth2, getPortalStandaloneSignInOrRegisterUrl } from "./auth-utils";
import { reprocessUrlParams } from "./url-params";

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

  describe("getPortalStandaloneSignInOrRegisterUrl", () => {
    // functions to mock and reset window.location and url params
    const originalLocation = window.location;
    const mockWindowLocation = (newLocation: Location | URL) => {
      delete (window as any).location;
      (window as any).location = newLocation as Location;
      reprocessUrlParams();
    };
    const setLocation = (url: string) => mockWindowLocation(new URL(url));
    afterEach(() => mockWindowLocation(originalLocation));

    it("uses the portalDomain param if present", () => {
      setLocation("https://collaborative-learning.concord.org/standalone/?portalDomain=https://example.com");
      const expectedURL = "https://example.com/users/sign_in_or_register?app_name=CLUE&login_url=https%3A%2F%2Fcollaborative-learning.concord.org%2Fstandalone%2F%3FportalDomain%3Dhttps%253A%252F%252Fexample.com%26authDomain%3Dstandalone";
      const actualURL = getPortalStandaloneSignInOrRegisterUrl();
      expect(actualURL).toBe(expectedURL);
    });

    it("returns the learn production URL for production", () => {
      setLocation("https://collaborative-learning.concord.org/standalone/");
      const expectedURL = "https://learn.concord.org/users/sign_in_or_register?app_name=CLUE&login_url=https%3A%2F%2Fcollaborative-learning.concord.org%2Fstandalone%2F%3FauthDomain%3Dstandalone";
      const actualURL = getPortalStandaloneSignInOrRegisterUrl();
      expect(actualURL).toBe(expectedURL);
    });

    it("returns the learn staging URL for branches", () => {
      setLocation("https://collaborative-learning.concord.org/branch/master/standalone/");
      const expectedURL = "https://learn.portal.staging.concord.org/users/sign_in_or_register?app_name=CLUE&login_url=https%3A%2F%2Fcollaborative-learning.concord.org%2Fbranch%2Fmaster%2Fstandalone%2F%3FauthDomain%3Dstandalone";
      const actualURL = getPortalStandaloneSignInOrRegisterUrl();
      expect(actualURL).toBe(expectedURL);
    });

    it("returns the learn staging URL for localhost", () => {
      setLocation("http://localhost:8080/standalone/");
      const expectedURL = "https://learn.portal.staging.concord.org/users/sign_in_or_register?app_name=CLUE&login_url=http%3A%2F%2Flocalhost%3A8080%2Fstandalone%2F%3FauthDomain%3Dstandalone";
      const actualURL = getPortalStandaloneSignInOrRegisterUrl();
      expect(actualURL).toBe(expectedURL);
    });

    it("returns the learn staging URL for anything but production", () => {
      setLocation("https://example.com/standalone/");
      const expectedURL = "https://learn.portal.staging.concord.org/users/sign_in_or_register?app_name=CLUE&login_url=https%3A%2F%2Fexample.com%2Fstandalone%2F%3FauthDomain%3Dstandalone";
      const actualURL = getPortalStandaloneSignInOrRegisterUrl();
      expect(actualURL).toBe(expectedURL);
    });

    it("adds the classWord param to the redirect URL if present", () => {
      setLocation("https://collaborative-learning.concord.org/standalone/?classWord=m2studio");
      const expectedURL = "https://learn.concord.org/users/sign_in_or_register?app_name=CLUE&login_url=https%3A%2F%2Fcollaborative-learning.concord.org%2Fstandalone%2F%3FclassWord%3Dm2studio%26authDomain%3Dstandalone&class_word=m2studio";
      const actualURL = getPortalStandaloneSignInOrRegisterUrl();
      expect(actualURL).toBe(expectedURL);
    });

    it("adds the classWord param to the auth URL if classWord is present", () => {
      setLocation("https://collaborative-learning.concord.org/standalone/?classWord=m2studio");
      const expectedURL = "https://learn.concord.org/users/sign_in_or_register?app_name=CLUE&login_url=https%3A%2F%2Fcollaborative-learning.concord.org%2Fstandalone%2F%3FclassWord%3Dm2studio%26authDomain%3Dstandalone&class_word=m2studio";
      const actualURL = getPortalStandaloneSignInOrRegisterUrl();
      expect(actualURL).toBe(expectedURL);
    });
  });
});
