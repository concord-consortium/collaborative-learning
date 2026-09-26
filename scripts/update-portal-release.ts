#!/usr/bin/node

/**
 * Point a portal's CLUE settings at a new release, as part of preparing that release.
 *
 * - Adds the release's `version/<tag>/` and `branch/<vX.Y.x>/` folders to the redirect URIs of
 *   the portal OAuth client CLUE logs in through, so launches of the release can authenticate.
 * - Moves the given external reports and external activities (resources) from whatever release
 *   they point at to this one: the `version/<tag>/` or `branch/<vX.Y.x>/` part of each URL, and
 *   any version or release-branch name in the name (and a report's launch text), is rewritten.
 *   Everything else — including a `?firebaseEnv=` query — is kept.
 *
 * Every write is read back to confirm it took. Fields that must survive the update (a report's
 * type and OAuth client, an activity's attached reports and auth-token setting) are compared
 * before and after, and a change is reported as an error. Re-running is safe: anything already
 * pointing at the release is left alone.
 *
 * Usage (from the scripts directory):
 *
 *   npx tsx update-portal-release.ts --tag v7.6.0 --dry-run
 *   npx tsx update-portal-release.ts --tag v7.6.0 --report-id 10 --report-id 77
 *   npx tsx update-portal-release.ts --tag v7.6.0 --report-id 10 --activity-id 594 --activity-id 595
 *
 * See scripts/README.md for the token setup. setup-portal-assignment.ts is the companion for
 * creating a smoke-test assignment of a release.
 */

import {
  PortalSession, isPortalName, portalNames, PortalName, readFormField, readFormSelect, readFormCheckbox,
  readCheckedValues
} from "./lib/portal-api.js";
import { kClueOAuthAppId, findOAuthClientId, ensureRedirectUri } from "./lib/portal-oauth.js";
import { releasePaths, retargetText, retargetUrl } from "./lib/release-portal.js";

const kDefaultClueBase = "https://collaborative-learning.concord.org";
/** The staging portal's long-standing "CLUE (test)" report, moved to each release. */
const kDefaultReportIds = [10];

interface IOptions {
  tag: string;
  portal: PortalName;
  clueBase: string;
  reportIds: number[];
  activityIds: number[];
  dryRun: boolean;
}

function usage(message?: string): never {
  if (message) console.error(`\nError: ${message}\n`);
  console.error(`
Usage: npx tsx update-portal-release.ts --tag <vX.Y.Z> [options]

  --tag <tag>          Release tag, e.g. v7.6.0.
  --portal <name>      ${portalNames.join(" | ")} (default staging).
  --report-id <id>     External report to move to this release. Repeat for several.
                       Default: ${kDefaultReportIds.join(", ")}.
  --activity-id <id>   External activity (resource) to move to this release. Repeat for several.
  --clue-base <url>    CLUE site (default ${kDefaultClueBase}).
  --dry-run            Show what would change without writing anything.
`);
  process.exit(message ? 1 : 0);
}

function parseOptions(argv: string[]): IOptions {
  const options: IOptions = {
    tag: "", portal: "staging", clueBase: kDefaultClueBase, reportIds: [], activityIds: [], dryRun: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const next = argv[++i];
      if (!next || next.startsWith("--")) usage(`${arg} needs a value`);
      return next;
    };
    if (arg === "--tag") {
      options.tag = value();
    } else if (arg === "--portal") {
      const portal = value();
      if (!isPortalName(portal)) usage(`unknown portal "${portal}"`);
      options.portal = portal;
    } else if (arg === "--report-id") {
      const id = Number(value());
      if (!Number.isInteger(id) || id <= 0) usage(`--report-id must be a positive integer`);
      options.reportIds.push(id);
    } else if (arg === "--activity-id") {
      const id = Number(value());
      if (!Number.isInteger(id) || id <= 0) usage(`--activity-id must be a positive integer`);
      options.activityIds.push(id);
    } else if (arg === "--clue-base") {
      options.clueBase = value().replace(/\/$/, "");
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--help") {
      usage();
    } else {
      usage(`unknown argument ${arg}`);
    }
  }
  if (!/^v\d+\.\d+\.\d+$/.test(options.tag)) usage("--tag must be a release tag like v7.6.0");
  if (!options.reportIds.length) options.reportIds = kDefaultReportIds;
  return options;
}

/**
 * A kind of portal record that points at a CLUE release. The fields in `retargeted` are moved to
 * the release; the fields in `preserved` are only read, and must be the same after the update.
 */
interface IRecordKind {
  label: string;
  editPath: (id: number) => string;
  updatePath: (id: number) => string;
  /** form field name -> value, read from the edit page; undefined when the field is absent. */
  retargeted: (page: string) => Record<string, string | undefined>;
  preserved: (page: string) => Record<string, string | undefined>;
  urlField: string;
  nameField: string;
}

const kExternalReport: IRecordKind = {
  label: "External report",
  editPath: id => `/admin/external_reports/${id}/edit`,
  updatePath: id => `/admin/external_reports/${id}`,
  retargeted: page => ({
    "external_report[name]": readFormField(page, "external_report_name"),
    "external_report[url]": readFormField(page, "external_report_url"),
    "external_report[launch_text]": readFormField(page, "external_report_launch_text")
  }),
  preserved: page => ({
    "report type": readFormSelect(page, "external_report_report_type"),
    "OAuth client": readFormSelect(page, "external_report_client_id")
  }),
  urlField: "external_report[url]",
  nameField: "external_report[name]"
};

const kExternalActivity: IRecordKind = {
  label: "External activity",
  editPath: id => `/eresources/${id}/edit`,
  updatePath: id => `/eresources/${id}`,
  retargeted: page => ({
    "external_activity[name]": readFormField(page, "external_activity_name"),
    "external_activity[url]": readFormField(page, "external_activity_url")
  }),
  // The update only applies the fields it is sent, so these should never change; checking them
  // catches a portal that starts resetting unsent fields.
  preserved: page => ({
    "attached reports": readCheckedValues(page, "external_reports[]").join(","),
    "append auth token": String(readFormCheckbox(page, "external_activity_append_auth_token"))
  }),
  urlField: "external_activity[url]",
  nameField: "external_activity[name]"
};

async function moveRecord(portal: PortalSession, options: IOptions, kind: IRecordKind, id: number) {
  const beforePage = await portal.getText(kind.editPath(id));
  const before = kind.retargeted(beforePage);
  const beforeUrl = before[kind.urlField];
  if (beforeUrl === undefined || before[kind.nameField] === undefined) {
    throw new Error(`Could not read ${kind.label.toLowerCase()} ${id}'s url and name from its edit page`);
  }
  if (!/\/(version|branch)\/v\d/.test(beforeUrl)) {
    throw new Error(
      `${kind.label} ${id} (${before[kind.nameField]}) points at ${beforeUrl}, which names no release ` +
      `to move. Refusing to guess.`
    );
  }
  const target: Record<string, string | undefined> = {};
  for (const [field, value] of Object.entries(before)) {
    target[field] = value === undefined ? undefined
      : field === kind.urlField ? retargetUrl(value, options.tag) : retargetText(value, options.tag);
  }
  const changes = Object.keys(before)
    .filter(field => target[field] !== before[field])
    .map(field => ({ field, from: before[field], to: target[field] }));
  if (!changes.length || options.dryRun) return { name: before[kind.nameField], url: beforeUrl, changes };

  // Only the fields being moved are sent; the update leaves the others as they are, which the
  // read-back below confirms for the ones that matter most.
  const fields: Record<string, string> = {};
  for (const { field, to } of changes) fields[field] = to!;
  await portal.submitForm(kind.editPath(id), kind.updatePath(id), fields, "put");

  const afterPage = await portal.getText(kind.editPath(id));
  const after = kind.retargeted(afterPage);
  if (changes.some(({ field, to }) => after[field] !== to)) {
    throw new Error(
      `The portal accepted the update, but ${kind.label.toLowerCase()} ${id} did not change as expected. ` +
      `Check that this token may edit it.`
    );
  }
  const preservedBefore = kind.preserved(beforePage);
  const preservedAfter = kind.preserved(afterPage);
  const altered = Object.keys(preservedBefore).filter(key => preservedBefore[key] !== preservedAfter[key]);
  if (altered.length) {
    throw new Error(
      `Updating ${kind.label.toLowerCase()} ${id} changed its ` +
      altered.map(key => `${key} (${preservedBefore[key]} -> ${preservedAfter[key]})`).join(", ") +
      `. Check it by hand.`
    );
  }
  return { name: before[kind.nameField], url: beforeUrl, changes };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const portal = new PortalSession(options.portal);
  // Enforced by the session rather than by each caller checking options.dryRun, so a missed
  // check fails loudly instead of quietly changing the portal.
  portal.readOnly = options.dryRun;
  const would = (done: string, pending: string) => options.dryRun ? pending : done;

  console.log(`Portal:  ${portal.baseUrl}${options.dryRun ? "  (DRY RUN — nothing will be written)" : ""}`);
  console.log(`Release: ${options.tag}\n`);

  const clientId = await findOAuthClientId(portal, kClueOAuthAppId);
  console.log(`OAuth client ${clientId} (app_id "${kClueOAuthAppId}") redirect URIs:`);
  for (const path of releasePaths(options.tag)) {
    const uri = `${options.clueBase}/${path}`;
    const result = await ensureRedirectUri(portal, clientId, uri, options.dryRun);
    console.log(`  ${result.changed ? would("added", "would add") : "already present"}: ${uri}`);
  }

  const records = [
    ...options.reportIds.map(id => ({ kind: kExternalReport, id })),
    ...options.activityIds.map(id => ({ kind: kExternalActivity, id }))
  ];
  for (const { kind, id } of records) {
    const { name, url, changes } = await moveRecord(portal, options, kind, id);
    const status = changes.length ? would("updated", "would update") : "already on this release";
    console.log(`\n${kind.label} ${id}: ${status}`);
    if (changes.length) {
      for (const { field, from, to } of changes) console.log(`  ${field}: ${from}  ->  ${to}`);
    } else {
      console.log(`  ${name}: ${url}`);
    }
  }

  console.log(options.dryRun ? "\nDry run complete. Re-run without --dry-run to apply." : "\nDone.");
}

main().catch(error => {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
