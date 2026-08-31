#!/usr/bin/node

/**
 * Set up everything the portal needs to smoke-test a build of CLUE against the real
 * Firebase security rules: a resource, an assignment of it to a class, a teacher report,
 * and an OAuth redirect URI.
 *
 * Most of CLUE's automated tests run in `demo` or `qa` appMode, which live under Firebase
 * paths whose rules are simply `if isAuthed()`. Only a real portal launch exercises the
 * `authed/<portal>` rules, and only a launch carrying a portal token counts as one — hence
 * this script, and hence how much of it is about making sure that token is actually sent.
 *
 * Every step is idempotent: re-running with the same arguments reuses what is already there
 * rather than creating duplicates, so it is safe to run again after changing one flag.
 *
 * Usage (from the scripts directory):
 *
 *   npx tsx setup-portal-assignment.ts \
 *     --clue-path version/v7.5.0 \
 *     --class-id 111 \
 *     --unit seismic \
 *     --problem 1.1
 *
 * See scripts/README.md for the token setup, and the `setting-up-portal-assignments` skill for
 * help choosing the class, unit, and problem.
 */

import {
  PortalSession, PortalError, isPortalName, portalNames, PortalName,
  readFormField, readCheckedValues, collectAdminIndexIds
} from "./lib/portal-api.js";

const kClueBase = "https://collaborative-learning.concord.org";
/** The `app_id` of the portal OAuth client CLUE authenticates against (OAUTH_CLIENT_NAME). */
const kClueOAuthAppId = "clue";
/** The portal's allowlist rule covering collaborative-learning.concord.org URLs. */
const kClueStandaloneRule = "clue-standalone";
/** Admin index pages are paginated; this bounds the scan when looking for an existing record. */
const kMaxAdminPages = 20;
/**
 * The Firebase projects CLUE knows about (`validProjects` in src/lib/firebase-config.ts).
 * Anything else in the URL falls back to production without complaint, which would point a
 * staging smoke test at the production database while the resource name said otherwise.
 */
const kFirebaseEnvs = ["staging", "production"];
/** Options taking a value, and valueless flags. Anything else is a typo, not a feature. */
const kValueOptions = [
  "clue-path", "class-id", "unit", "problem", "portal", "firebase-env",
  "name", "clue-base", "activity-id", "oauth-client-id"
];
const kFlagOptions = ["help", "no-report", "no-redirect", "dry-run"];

interface IOptions {
  portal: PortalName;
  cluePath: string;
  classId: string;
  unit: string;
  problem: string;
  firebaseEnv: string;
  name?: string;
  clueBase: string;
  activityId?: number;
  oauthClientId?: number;
  withReport: boolean;
  withRedirect: boolean;
  dryRun: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`\nError: ${message}\n`);
  console.error(`
Usage: npx tsx setup-portal-assignment.ts [options]

Required:
  --clue-path <path>    Deployed CLUE path: "version/<tag>" or "branch/<name>".
                        For a branch, use the DEPLOYED name: the deploy action strips a
                        Jira prefix, so branch CLUE-123-my-feature deploys to branch/my-feature.
  --class-id <id>       Portal class id. Class names are not unique across teachers, so the
                        id is what identifies a class.
  --unit <unit>         Unit code (e.g. "seismic") or a demo unit path
                        (e.g. "./demo/units/qa/content.json").
  --problem <ordinal>   Problem ordinal, e.g. "1.1".

Optional:
  --portal <name>       ${portalNames.join(" | ")} (default: staging)
  --firebase-env <env>  ${kFirebaseEnvs.join(" | ")}: the Firebase project CLUE connects to
                        (default: matches --portal). Omitted from URLs when "production",
                        which is CLUE's own default.
  --name <name>         Resource name (default: derived from unit, problem and CLUE path).
  --clue-base <url>     CLUE deployment root (default: ${kClueBase}).
  --activity-id <id>    Use this existing external activity instead of finding or creating one.
  --oauth-client-id <id>  Portal OAuth client to update (default: found by app_id "${kClueOAuthAppId}").
  --no-report           Skip creating and attaching the teacher report.
  --no-redirect         Skip adding the OAuth redirect URI.
  --dry-run             Report what would change without writing anything.
  --help
`);
  process.exit(message ? 1 : 0);
}

/**
 * A portal record id. Rejecting a non-numeric value matters more than it looks: `Number("x")`
 * is NaN, NaN is falsy, and every use of these ids treats a falsy id as "not given" — so a
 * typo would not fail, it would quietly create a second activity or skip the report.
 */
function parseId(raw: Record<string, string>, key: string) {
  const value = raw[key];
  if (value === undefined) return undefined;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    usage(`--${key} must be a positive integer, got "${value}"`);
  }
  return id;
}

function parseOptions(argv: string[]): IOptions {
  const raw: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) usage(`Unexpected argument "${arg}"`);
    const key = arg.slice(2);
    // Match against the known names rather than a shape ("starts with no-"), so a misspelled
    // --no-repot is an error instead of an inert flag that leaves the default in force. This
    // command writes to a shared portal; a typo must not silently mean something else.
    if (kFlagOptions.includes(key)) {
      flags.add(key);
    } else if (kValueOptions.includes(key)) {
      const value = argv[++i];
      if (value === undefined) usage(`Missing value for --${key}`);
      raw[key] = value;
    } else {
      usage(`Unknown option "--${key}"`);
    }
  }
  if (flags.has("help")) usage();

  for (const required of ["clue-path", "class-id", "unit", "problem"]) {
    if (!raw[required]) usage(`--${required} is required`);
  }

  const portal = raw.portal ?? "staging";
  if (!isPortalName(portal)) usage(`--portal must be one of: ${portalNames.join(", ")}`);

  const cluePath = raw["clue-path"].replace(/^\/|\/$/g, "");
  if (!/^(version|branch)\/.+/.test(cluePath)) {
    usage(`--clue-path must look like "version/<tag>" or "branch/<name>", got "${cluePath}"`);
  }
  if (!/^\d+\.\d+$/.test(raw.problem)) {
    usage(`--problem must look like "1.1", got "${raw.problem}"`);
  }
  const firebaseEnv = raw["firebase-env"] ?? portal;
  if (!kFirebaseEnvs.includes(firebaseEnv)) {
    usage(`--firebase-env must be one of: ${kFirebaseEnvs.join(", ")}, got "${firebaseEnv}"`);
  }

  return {
    portal,
    cluePath,
    classId: raw["class-id"],
    unit: raw.unit,
    problem: raw.problem,
    // The portal and the Firebase project are independent choices, but pairing them is
    // almost always what is wanted: a staging portal launch that wrote to production
    // Firebase would be testing the rules of a project the assignment does not belong to.
    firebaseEnv,
    name: raw.name,
    clueBase: (raw["clue-base"] ?? kClueBase).replace(/\/$/, ""),
    activityId: parseId(raw, "activity-id"),
    oauthClientId: parseId(raw, "oauth-client-id"),
    withReport: !flags.has("no-report"),
    withRedirect: !flags.has("no-redirect"),
    dryRun: flags.has("dry-run")
  };
}

//
// URL construction
//

/** `production` is CLUE's own default, so naming it in the URL only adds noise. */
function firebaseEnvParam(firebaseEnv: string) {
  return firebaseEnv !== "production" ? { firebaseEnv } : {};
}

/** How a non-default Firebase project is named in a portal record, so the two agree. */
function firebaseLabel(firebaseEnv: string) {
  return firebaseEnv !== "production" ? `, ${firebaseEnv} FB` : "";
}

function buildUrl(base: string, params: Record<string, string>) {
  // A slash is legal unescaped in a query value, and demo units are passed as paths
  // ("./demo/units/qa/content.json"). Leaving them as slashes keeps these URLs readable in
  // the portal's UI and matches how the existing CLUE resources there are written.
  const query = new URLSearchParams(params).toString().replace(/%2F/g, "/");
  return query ? `${base}?${query}` : base;
}

function buildUrls(options: IOptions) {
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

function describeCluePath(cluePath: string) {
  const [kind, ...rest] = cluePath.split("/");
  const label = rest.join("/");
  return kind === "branch" ? `${label} branch` : label;
}

function defaultName(options: IOptions) {
  // A demo unit's "code" is a path; its directory name is the readable part.
  const unitLabel = options.unit.replace(/^.*\/units\//, "").replace(/\/content\.json$/, "");
  return `CLUE ${unitLabel} ${options.problem} ` +
    `(${describeCluePath(options.cluePath)}${firebaseLabel(options.firebaseEnv)})`;
}

//
// Steps
//

interface IClassInfo { id: number; name: string; teachers: string[] }

async function fetchClass(portal: PortalSession, classId: string): Promise<IClassInfo> {
  const data = await portal.json<any>(`/api/v1/classes/${classId}`);
  return {
    id: data.id,
    name: data.name,
    teachers: (data.teachers ?? []).map((t: any) => `${t.first_name} ${t.last_name}`.trim())
  };
}

/**
 * The id of the external activity with this url, or undefined.
 *
 * There is no lookup-by-url endpoint. The search endpoint is the closest thing, but it
 * returns only the first page of each material group, so a miss here does NOT prove the
 * activity is absent — `claimActivityByUrl` is the closer thing to a real existence check.
 */
async function findActivityIdByUrl(portal: PortalSession, url: string) {
  const search = await portal.json<any>("/api/v1/search/search?query=");
  for (const group of search.results ?? []) {
    for (const material of group.materials ?? []) {
      if ((material.external_url ?? material.url) === url) return material.id as number;
    }
  }
  return undefined;
}

/**
 * Set `append_auth_token` on the activity with this url, and report whether one existed.
 *
 * This is the only probe the portal offers for "is there an activity at this url" — and it
 * is a WRITE. There is no read-only equivalent, which is why the dry-run path below must
 * never call it. On a miss the portal authorizes a nil record, which raises inside Pundit
 * and renders its generic 500 page — the very same page any other server-side failure
 * renders, so the response cannot say which of the two happened.
 *
 * Hence the retry: a missing activity 500s every time, while a transient failure usually
 * does not repeat. Reading a one-off failure as "absent" would send the caller on to create
 * a second activity at a url that already has one.
 *
 * The flag is always set to true. It has no legitimate false value here: false is what
 * makes the portal omit the token, which drops CLUE into preview mode.
 */
async function claimActivityByUrl(portal: PortalSession, url: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      await portal.json("/api/v1/external_activities/update_by_url", {
        method: "POST",
        form: { url, append_auth_token: "true" }
      });
      return true;
    } catch (error) {
      if (!(error instanceof PortalError) || error.status !== 500) throw error;
      if (attempt > 0) return false;
    }
  }
}

async function ensureActivity(portal: PortalSession, options: IOptions, url: string, name: string) {
  if (options.activityId) {
    if (!options.dryRun) await claimActivityByUrl(portal, url);
    return { id: options.activityId, created: false };
  }

  // A dry run may not write, and the only existence probe the portal offers is a write. So
  // fall back to the read-only search, and be explicit that a miss is inconclusive rather
  // than reporting a create that may turn out to be a reuse.
  if (options.dryRun) {
    const searchId = await findActivityIdByUrl(portal, url);
    return { id: searchId ?? 0, created: !searchId, uncertain: !searchId };
  }

  const exists = await claimActivityByUrl(portal, url);
  if (exists) {
    const existingId = await findActivityIdByUrl(portal, url);
    if (!existingId) {
      throw new Error(
        `An external activity already uses this URL, but its id could not be resolved ` +
        `(the portal's search only returns recent materials). Open it in the portal and ` +
        `re-run with --activity-id <id>.`
      );
    }
    return { id: existingId, created: false };
  }

  // Two 500s say the activity is probably absent, but "probably" is doing real work there:
  // the portal cannot distinguish that from a failure of its own. Spend one more read before
  // creating — a duplicate resource at the same url is worse than stopping and asking.
  const searchId = await findActivityIdByUrl(portal, url);
  if (searchId) {
    throw new Error(
      `The portal failed to update the activity at this URL, but its search still finds one ` +
      `(id ${searchId}). The portal may be having trouble; re-run, or re-run with ` +
      `--activity-id ${searchId} if it keeps failing.`
    );
  }

  // `append_auth_token` is the setting this whole script exists to get right. Without it
  // the portal appends neither a token nor domain/domain_uid, CLUE runs in preview mode
  // (appMode "demo"), and every write goes to the permissive /demo/ Firebase tree — the
  // smoke test would pass while testing none of the rules it was meant to test.
  const created = await portal.json<{ edit_url: string }>("/api/v1/external_activities", {
    method: "POST",
    form: {
      name,
      url,
      type: "Activity",
      publication_status: "published",
      append_auth_token: "true"
    }
  });
  const id = Number(created.edit_url.match(/\/eresources\/(\d+)/)?.[1]);
  if (!id) throw new Error(`Could not read the new activity's id from ${created.edit_url}`);
  return { id, created: true };
}

async function ensureOffering(portal: PortalSession, options: IOptions, url: string, name: string) {
  if (options.dryRun) return { id: 0 };
  // This endpoint reuses an existing offering for the same class and url, so it is safe to
  // call repeatedly.
  //
  // `rule` names an Admin::AutoExternalActivityRule: an allowlist that lets this endpoint
  // create an activity from a caller-supplied URL without the caller being an admin. It is
  // required unconditionally, but only dereferenced when the endpoint has to create the
  // activity itself — ours already exists by this point, so it is never looked up. We send
  // the real slug anyway (the same one CLUE's own standalone flow uses; see
  // createPortalOffering in src/lib/portal-api.ts), whose patterns cover
  // collaborative-learning.concord.org, so the call would still work if that stopped
  // holding.
  const offering = await portal.json<{ id: number }>("/api/v1/offerings/create_for_external_activity", {
    method: "POST",
    form: { class_id: options.classId, name, url, rule: kClueStandaloneRule }
  });
  return offering;
}

/** The portal OAuth client with this app_id. Both the report and the redirect URIs need it. */
async function findOAuthClientId(portal: PortalSession, appId: string) {
  const ids = await collectAdminIndexIds(portal, "/admin/clients", "admin/clients", kMaxAdminPages);
  for (const id of ids) {
    const page = await portal.getText(`/admin/clients/${id}/edit`);
    if (readFormField(page, "client_app_id") === appId) return id;
  }
  throw new Error(
    `No portal OAuth client found with app_id "${appId}" (searched ${ids.length} clients). ` +
    `Pass --oauth-client-id to name it directly.`
  );
}

async function findReportIdByUrl(portal: PortalSession, url: string) {
  const ids = await collectAdminIndexIds(
    portal, "/admin/external_reports", "admin/external_reports", kMaxAdminPages
  );
  for (const id of ids) {
    const editPage = await portal.getText(`/admin/external_reports/${id}/edit`);
    if (readFormField(editPage, "external_report_url") === url) return id;
  }
  return undefined;
}

async function ensureReport(portal: PortalSession, options: IOptions, url: string, clientId: number) {
  const existing = await findReportIdByUrl(portal, url);
  if (existing) return { id: existing, created: false };
  if (options.dryRun) return { id: 0, created: true };

  const name =
    `CLUE Teacher Tools (${describeCluePath(options.cluePath)}${firebaseLabel(options.firebaseEnv)})`;
  await portal.submitForm("/admin/external_reports/new", "/admin/external_reports", {
    "external_report[name]": name,
    "external_report[url]": url,
    "external_report[launch_text]": name,
    "external_report[report_type]": "offering",
    "external_report[client_id]": String(clientId)
  });
  const id = await findReportIdByUrl(portal, url);
  if (!id) throw new Error("Created the external report but could not find it afterwards");
  return { id, created: true };
}

async function attachReport(portal: PortalSession, options: IOptions, activityId: number, reportId: number) {
  const editPage = await portal.getText(`/eresources/${activityId}/edit`);
  const attached = readCheckedValues(editPage, "external_reports[]");
  if (attached.includes(String(reportId))) return { changed: false };
  if (options.dryRun) return { changed: true };

  // Setting external_report_ids replaces the whole set, so keep whatever is already there.
  // The update action explicitly tolerates a request with no `external_activity` hash, so
  // sending only these two keys leaves every other field of the activity untouched —
  // including append_auth_token, which a careless full-form post could silently reset.
  await portal.submitForm(
    `/eresources/${activityId}/edit`,
    `/eresources/${activityId}`,
    {
      update_external_reports: "1",
      "external_reports[]": [...attached, String(reportId)]
    },
    "put"
  );
  return { changed: true };
}

async function ensureRedirectUri(portal: PortalSession, options: IOptions, clientId: number, redirectUri: string) {
  const editPage = await portal.getText(`/admin/clients/${clientId}/edit`);
  const current = readFormField(editPage, "client_redirect_uris") ?? "";
  const currentUris = current.split(/\s+/).filter(Boolean);

  // This client is shared by every CLUE deployment, and the field is rewritten whole. If the
  // page parsed into something that does not look like a list of URIs, the safe assumption is
  // that the parser is wrong rather than that the client really holds one odd value — writing
  // on that assumption would replace everyone else's URIs with a single corrupted entry.
  if (current.trim() && !currentUris.every(uri => /^https?:\/\//.test(uri))) {
    throw new Error(
      `Could not parse the OAuth client's redirect URIs into a list ` +
      `(got ${currentUris.length} entr${currentUris.length === 1 ? "y" : "ies"}, ` +
      `first: "${currentUris[0]?.slice(0, 80)}"). Refusing to overwrite the field.`
    );
  }

  if (currentUris.includes(redirectUri)) return { changed: false, count: currentUris.length };
  if (options.dryRun) return { changed: true, count: currentUris.length + 1 };

  // redirect_uris is one whitespace-separated field, so adding an entry means resending the
  // whole list. Append rather than rebuild: this client is shared, and dropping somebody
  // else's URI would break their deployment with no obvious cause.
  const updated = `${current.replace(/\s*$/, "")}\n${redirectUri}\n`;
  await portal.submitForm(
    `/admin/clients/${clientId}/edit`,
    `/admin/clients/${clientId}`,
    { "client[redirect_uris]": updated },
    "put"
  );

  const verifyPage = await portal.getText(`/admin/clients/${clientId}/edit`);
  const after = (readFormField(verifyPage, "client_redirect_uris") ?? "").split(/\s+/).filter(Boolean);
  const dropped = current.split(/\s+/).filter(Boolean).filter(uri => !after.includes(uri));
  if (dropped.length > 0) {
    throw new Error(`Updating the OAuth client dropped existing redirect URIs: ${dropped.join(", ")}`);
  }
  if (!after.includes(redirectUri)) throw new Error("The redirect URI was not saved");
  return { changed: true, count: after.length };
}

//
// Main
//

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const portal = new PortalSession(options.portal);
  // Enforced by the session rather than by each caller checking options.dryRun, so a missed
  // check fails loudly instead of quietly changing the portal.
  portal.readOnly = options.dryRun;
  const urls = buildUrls(options);
  const name = options.name ?? defaultName(options);

  console.log(`Portal:      ${portal.baseUrl}${options.dryRun ? "  (DRY RUN — nothing will be written)" : ""}`);
  console.log(`Resource:    ${name}`);
  console.log(`Student URL: ${urls.activity}`);
  console.log("");

  const classInfo = await fetchClass(portal, options.classId);
  console.log(`Class ${classInfo.id}: ${classInfo.name} (teachers: ${classInfo.teachers.join(", ") || "none"})`);

  const activity = await ensureActivity(portal, options, urls.activity, name);
  if (activity.uncertain) {
    console.log("Activity: would create, or reuse an existing one at this URL " +
      "(a dry run cannot tell — the read-only search covers only recent materials)");
  } else {
    const state = activity.created ? "created" : "reused";
    console.log(`Activity ${activity.id}: ${state}, append_auth_token=true`);
  }

  const offering = await ensureOffering(portal, options, urls.activity, name);
  console.log(offering.id
    ? `Offering ${offering.id}: assigned to class ${options.classId}`
    // The endpoint both finds and creates, so a dry run cannot tell which it would do
    // without calling it. Say that, rather than implying the offering is missing.
    : `Offering: would assign to class ${options.classId} (existing offering reused if there is one)`);

  let reportId: number | undefined;
  let clientId: number | undefined;
  if (options.withReport || options.withRedirect) {
    clientId = options.oauthClientId ?? await findOAuthClientId(portal, kClueOAuthAppId);
    console.log(`OAuth client ${clientId}: app_id "${kClueOAuthAppId}"`);
  }

  if (options.withReport && clientId) {
    const report = await ensureReport(portal, options, urls.report, clientId);
    reportId = report.id;
    // A dry run must never claim it did something. Only a real run reports past tense.
    const madeReport = options.dryRun ? "would create" : "created";
    const reportState = report.created ? madeReport : "reused";
    console.log(`Report ${report.id || "(new)"}: ${reportState} -> ${urls.report}`);
    if (activity.id) {
      const attached = await attachReport(portal, options, activity.id, report.id);
      const attachState = attached.changed
        ? (options.dryRun ? "would attach" : "yes (added)")
        : "yes (already)";
      console.log(`Report attached to activity: ${attachState}`);
    }
  }

  if (options.withRedirect && clientId) {
    const redirect = await ensureRedirectUri(portal, options, clientId, urls.redirect);
    const added = options.dryRun ? "would be added" : "added";
    const state = redirect.changed ? added : "already present";
    console.log(`Redirect URI ${state} (${redirect.count} total): ${urls.redirect}`);
  }

  console.log("");
  if (options.dryRun) {
    console.log("Dry run complete. Re-run without --dry-run to apply.");
    return;
  }
  console.log("Launch as a student:  open the assignment from the class, NOT the resource page.");
  console.log("  A resource-page run never sends a token and always lands in preview mode.");
  if (reportId && offering.id) {
    console.log(`Launch as a teacher:  ${portal.url(`/portal/offerings/${offering.id}/external_report/${reportId}`)}`);
  }
  console.log("");
  console.log("Confirm the launch is authed: CLUE's appMode should be \"authed\", and writes");
  console.log("should land under /authed/portals/... rather than /demo/...");
}

main().catch(error => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
