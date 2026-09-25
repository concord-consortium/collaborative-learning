// Settings for specs that launch CLUE from a real portal assignment (cypress/e2e/portal/).
//
// Each run names its own users and assignment, so different schedules — a release smoke test,
// a nightly run — can use different ones and not share Firebase state. Passwords come from
// cypress.env.json locally and from secrets in CI; the ids are not secret and can be passed on
// the command line (`--env PORTAL_LAUNCH_OFFERING_ID=1242,...`) or set in a workflow's env.
// See cypress/e2e/portal/README.md.

const kDefaultPortalUrl = "https://learn.portal.staging.concord.org";

/**
 * What a launch runs. `baseUrl` keeps only the query string of the portal's redirect and runs it
 * on the build at the Cypress baseUrl — for testing a local, branch or older build. `portal`
 * visits the redirect as is, so the run also tests the resource's and report's URLs — for a
 * release, whose portal settings are part of what is being checked.
 */
const kTargets = ["baseUrl", "portal"];

const kRequiredKeys = [
  "PORTAL_LAUNCH_STUDENT_USERNAME", "PORTAL_LAUNCH_STUDENT_PASSWORD",
  "PORTAL_LAUNCH_TEACHER_USERNAME", "PORTAL_LAUNCH_TEACHER_PASSWORD",
  "PORTAL_LAUNCH_OFFERING_ID", "PORTAL_LAUNCH_REPORT_ID"
];

/**
 * The portal launch settings, or null when any required one is missing. Callers check for null
 * at the top of the spec and declare no tests at all rather than skipping them, so a run
 * without these settings adds nothing to the recorded test count.
 */
export function portalLaunchConfig() {
  const env = key => Cypress.env(key);
  if (kRequiredKeys.some(key => env(key) === undefined || env(key) === "")) return null;

  // Cypress turns numeric-looking values into numbers.
  const offeringId = String(env("PORTAL_LAUNCH_OFFERING_ID"));
  const reportId = String(env("PORTAL_LAUNCH_REPORT_ID"));
  const portalUrl = String(env("PORTAL_LAUNCH_PORTAL_URL") || kDefaultPortalUrl).replace(/\/$/, "");
  const expectedVersion = env("PORTAL_LAUNCH_EXPECTED_VERSION");
  const target = String(env("PORTAL_LAUNCH_TARGET") || "baseUrl");
  if (!kTargets.includes(target)) {
    throw new Error(`PORTAL_LAUNCH_TARGET must be one of ${kTargets.join(", ")}, not "${target}"`);
  }
  return {
    portalUrl,
    student: {
      username: String(env("PORTAL_LAUNCH_STUDENT_USERNAME")),
      password: String(env("PORTAL_LAUNCH_STUDENT_PASSWORD"))
    },
    teacher: {
      username: String(env("PORTAL_LAUNCH_TEACHER_USERNAME")),
      password: String(env("PORTAL_LAUNCH_TEACHER_PASSWORD"))
    },
    offeringId,
    reportId,
    keepClueUrl: target === "portal",
    expectedVersion: expectedVersion === undefined ? undefined : String(expectedVersion).replace(/^v/, ""),
    studentLaunchUrl: `${portalUrl}/portal/offerings/${offeringId}.run_resource_html`,
    teacherLaunchUrl: `${portalUrl}/portal/offerings/${offeringId}/external_report/${reportId}`
  };
}
