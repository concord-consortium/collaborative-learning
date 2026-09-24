import {
  checkEnvironment, checkPage, extractBuildInfo, extractVersionFolders, extractVersionScripts, IPageVersion
} from "./deployed-version";

// Excerpts from the production v7.5.0 deploy.
const kTopHtml = `
  <link rel="icon" href="version/v7.5.0/favicon.ico">
  <script src="https://www.googletagmanager.com/gtag/js?id=G-G4BPTMRZ4H"></script>
  <script defer="defer" src="version/v7.5.0/vendor-index-standalone.85a32641.js"></script>
  <script defer="defer" src="version/v7.5.0/index.f3f5b6c85990fa9869fe.js"></script>`;
const kEditorHtml = `
  <link rel="icon" href="../version/v7.5.0/favicon.ico">
  <script defer="defer" src="../version/v7.5.0/doc-editor.0123.js"></script>`;
const kBundleJsonParse = `16),y=n(8939),w=n(1866),E=JSON.parse('{"gitSha":"e7cdccb8d660dfeb13c86874956f76266e7290e8",` +
  `"branch":null,"tag":"v7.5.0","date":null}');const T=({authoring:e})=>{};` +
  `O=(0,m._w)({appMode:s,appVersion:"7.5.0",gitInfo:E,appConfig:T,user:i})`;

describe("extractVersionFolders", () => {
  it("finds the version folder of a top-level page", () => {
    expect(extractVersionFolders(kTopHtml)).toEqual(["v7.5.0"]);
  });
  it("finds the version folder of a page one level down", () => {
    expect(extractVersionFolders(kEditorHtml)).toEqual(["v7.5.0"]);
  });
  it("reports every distinct folder", () => {
    const mixed = `${kTopHtml}<script src="version/v7.6.0/x.js"></script>`;
    expect(extractVersionFolders(mixed)).toEqual(["v7.5.0", "v7.6.0"]);
  });
  it("ignores external resources", () => {
    expect(extractVersionFolders(`<script src="https://example.com/version/x/y.js"></script>`)).toEqual([]);
  });
});

describe("extractVersionScripts", () => {
  it("returns the version-folder scripts relative to the page", () => {
    expect(extractVersionScripts(kTopHtml)).toEqual([
      "version/v7.5.0/vendor-index-standalone.85a32641.js",
      "version/v7.5.0/index.f3f5b6c85990fa9869fe.js"
    ]);
    expect(extractVersionScripts(kEditorHtml)).toEqual(["../version/v7.5.0/doc-editor.0123.js"]);
  });
});

describe("extractBuildInfo", () => {
  it("reads appVersion and the JSON.parse form of version.json", () => {
    expect(extractBuildInfo(kBundleJsonParse)).toEqual({
      appVersion: "7.5.0",
      gitInfo: { gitSha: "e7cdccb8d660dfeb13c86874956f76266e7290e8", branch: null, tag: "v7.5.0", date: null }
    });
  });
  it("reads version.json inlined as an object literal", () => {
    const js = `const g={gitSha:"abc123",branch:"master",tag:null,date:"2026-09-01"};`;
    expect(extractBuildInfo(js)).toEqual({
      gitInfo: { gitSha: "abc123", branch: "master", tag: null, date: "2026-09-01" }
    });
  });
  it("returns nothing for a bundle without version information", () => {
    expect(extractBuildInfo(`!function(){var e={};}()`)).toEqual({});
  });
});

describe("checkPage", () => {
  const good: IPageVersion = {
    page: "index.html",
    folders: ["v7.5.0"],
    appVersion: "7.5.0",
    gitInfo: { gitSha: "e7cdccb8d", tag: "v7.5.0" }
  };

  it("accepts a consistent page", () => {
    expect(checkPage(good, "e7cdccb8d")).toEqual([]);
  });
  it("flags a compiled tag that differs from the folder", () => {
    expect(checkPage({ ...good, gitInfo: { gitSha: "e7cdccb8d", tag: null } }))
      .toEqual(["compiled git tag null does not match folder v7.5.0"]);
  });
  it("flags an appVersion that differs from the folder", () => {
    expect(checkPage({ ...good, appVersion: "4.3.0" }))
      .toEqual(["compiled appVersion 4.3.0 does not match folder v7.5.0"]);
  });
  it("flags a gitSha that differs from what the tag points to", () => {
    expect(checkPage(good, "ffffff")).toEqual(["compiled gitSha e7cdccb8d is not what v7.5.0 points to (ffffff)"]);
  });
  it("flags a page with no or several folders", () => {
    expect(checkPage({ page: "x", folders: [] })).toEqual(["no version/<tag>/ folder referenced"]);
    expect(checkPage({ ...good, folders: ["v7.5.0", "v7.6.0"] }))
      .toContain("references several version folders: v7.5.0, v7.6.0");
  });
  it("does not flag pages whose bundles lack version information", () => {
    expect(checkPage({ page: "authoring/index.html", folders: ["v7.5.0"] })).toEqual([]);
  });
  it("reports a fetch error as the only problem", () => {
    expect(checkPage({ page: "x", folders: [], error: "HTTP 404" })).toEqual(["HTTP 404"]);
  });
});

describe("checkEnvironment", () => {
  it("accepts pages serving one folder and flags pages serving several", () => {
    const page = (folder: string): IPageVersion => ({ page: folder, folders: [folder] });
    expect(checkEnvironment([page("v7.5.0"), page("v7.5.0")])).toEqual([]);
    expect(checkEnvironment([page("v7.5.0"), page("v7.6.0")]))
      .toEqual(["pages serve different versions: v7.5.0, v7.6.0"]);
  });
});
