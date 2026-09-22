/**
 * The URLs and names a portal assignment is built from.
 *
 * These are pure functions, kept apart from the script that calls them so they can be tested
 * without a portal — see portal-urls.test.ts. They earn that because the strings they produce
 * are not just what a user launches, they are the identity keys every idempotency check in
 * setup-portal-assignment.ts compares against: the activity is found by `external_url ===
 * url`, the report by `readFormField(...) === url`, and the OAuth redirect URI by exact
 * string equality inside the client's list. A change in parameter order or in escaping turns
 * every "reuse" into "create a duplicate on a shared portal", which nothing would report.
 */

/** The parts of a run that determine what its URLs and names look like. */
export interface IUrlOptions {
  /** CLUE deployment root, no trailing slash. */
  clueBase: string;
  /** Deployed path: `version/<tag>` or `branch/<name>`. */
  cluePath: string;
  /** Unit code, or a demo unit's content.json path. */
  unit: string;
  problem: string;
  firebaseEnv: string;
}

/** `production` is CLUE's own default, so naming it in the URL only adds noise. */
function firebaseEnvParam(firebaseEnv: string) {
  return firebaseEnv !== "production" ? { firebaseEnv } : {};
}

/** How a non-default Firebase project is named in a portal record, so the two agree. */
export function firebaseLabel(firebaseEnv: string) {
  return firebaseEnv !== "production" ? `, ${firebaseEnv} FB` : "";
}

function buildUrl(base: string, params: Record<string, string>) {
  // A slash is legal unescaped in a query value, and demo units are passed as paths
  // ("./demo/units/qa/content.json"). Leaving them as slashes keeps these URLs readable in
  // the portal's UI and matches how the existing CLUE resources there are written.
  const query = new URLSearchParams(params).toString().replace(/%2F/g, "/");
  return query ? `${base}?${query}` : base;
}

export function buildUrls(options: IUrlOptions) {
  const root = `${options.clueBase}/${options.cluePath}/`;
  return {
    /** What a student launches. The unit and problem make this assignment-specific. */
    activity: buildUrl(root, {
      unit: options.unit,
      problem: options.problem,
      ...firebaseEnvParam(options.firebaseEnv)
    }),
    /**
     * What a teacher launches. The portal merges its own report params (reportType,
     * offering, class, token, ...) into whatever query this already has, so firebaseEnv
     * set here survives — and it has to be here, or the teacher's CLUE would talk to a
     * different Firebase project than the students'.
     */
    report: buildUrl(root, firebaseEnvParam(options.firebaseEnv)),
    /**
     * What CLUE sends as its OAuth redirect_uri: `window.location.origin + pathname`, with
     * no query string. The portal compares this by exact string equality against the
     * client's list, so the trailing slash is significant.
     */
    redirect: root
  };
}

export function describeCluePath(cluePath: string) {
  const [kind, ...rest] = cluePath.split("/");
  const label = rest.join("/");
  return kind === "branch" ? `${label} branch` : label;
}

export function defaultName(options: IUrlOptions) {
  // A demo unit's "code" is a path; its directory name is the readable part.
  const unitLabel = options.unit.replace(/^.*\/units\//, "").replace(/\/content\.json$/, "");
  return `CLUE ${unitLabel} ${options.problem} ` +
    `(${describeCluePath(options.cluePath)}${firebaseLabel(options.firebaseEnv)})`;
}
