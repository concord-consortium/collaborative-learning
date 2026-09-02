import {
  findAuthenticityToken, readAdminIndexIds, readCheckedValues,
  readFormCheckbox, readFormField, readFormSelect
} from "./portal-html";

// Fixtures below are shaped the way Rails' form helpers emit these fields, since that is the
// only markup these readers ever meet. Nothing in CI reaches a real portal, so a change to
// the admin UI would otherwise be found by whoever next runs a setup script against one.

describe("readFormField", () => {
  it("reads an input's value", () => {
    const html = `<input type="text" name="client[app_id]" id="client_app_id" value="clue" />`;
    expect(readFormField(html, "client_app_id")).toBe("clue");
  });

  it("distinguishes a missing field from an empty one", () => {
    // These two must not collapse into each other. ensureRedirectUri rewrites the whole
    // redirect_uris field, so it appends to an empty one and refuses to touch an unreadable
    // one — treating a parse miss as "" would replace every deployment's URI with a single
    // entry, and the post-write check could not tell, since it reads with the same parser.
    expect(readFormField(`<input id="other" value="x">`, "client_app_id")).toBeUndefined();
    expect(readFormField(`<input id="client_app_id" value="">`, "client_app_id")).toBe("");
  });

  it("splits a textarea whose newlines Rails escaped as character references", () => {
    // This is what makes a redirect_uris field a list rather than one long value: Rails
    // writes the newlines as &#x000A;, so without decoding, every URI reads as one entry.
    const html =
      `<textarea name="client[redirect_uris]" id="client_redirect_uris">\n` +
      `https://a.example/&#x000A;https://b.example/</textarea>`;
    expect(readFormField(html, "client_redirect_uris")).toBe("https://a.example/\nhttps://b.example/");
  });

  it("drops the leading newline Rails adds inside a textarea", () => {
    const html = `<textarea id="client_redirect_uris">\nhttps://a.example/</textarea>`;
    expect(readFormField(html, "client_redirect_uris")).toBe("https://a.example/");
  });

  it("decodes an escaped ampersand once, not twice", () => {
    // &amp;#39; is a literal "&#39;" in the field, not an apostrophe. Decoding &amp; first
    // would turn it into one.
    const html = `<input id="external_report_url" value="https://x.example/?a=1&amp;#39;">`;
    expect(readFormField(html, "external_report_url")).toBe("https://x.example/?a=1&#39;");
  });

  it("reads the field with the requested id, not a similarly named neighbour", () => {
    const html =
      `<input id="external_report_launch_text" value="launch">` +
      `<input id="external_report_url" value="https://x.example/">`;
    expect(readFormField(html, "external_report_url")).toBe("https://x.example/");
  });
});

describe("readFormCheckbox", () => {
  it("reports a checked box, an unchecked one, and an absent one", () => {
    const checked =
      `<input type="checkbox" id="external_activity_append_auth_token" value="1" checked="checked">`;
    const unchecked = `<input type="checkbox" id="external_activity_append_auth_token" value="1">`;
    expect(readFormCheckbox(checked, "external_activity_append_auth_token")).toBe(true);
    expect(readFormCheckbox(unchecked, "external_activity_append_auth_token")).toBe(false);
    expect(readFormCheckbox(unchecked, "nope")).toBe(false);
  });
});

describe("readFormSelect", () => {
  it("reads the selected option's value", () => {
    const html =
      `<select id="external_report_report_type">` +
      `<option value="class">Class</option>` +
      `<option selected="selected" value="offering">Offering</option>` +
      `</select>`;
    expect(readFormSelect(html, "external_report_report_type")).toBe("offering");
  });

  it("returns undefined when nothing is selected, or the select is absent", () => {
    const html = `<select id="external_report_report_type"><option value="class">Class</option></select>`;
    expect(readFormSelect(html, "external_report_report_type")).toBeUndefined();
    expect(readFormSelect(html, "nope")).toBeUndefined();
  });
});

describe("readCheckedValues", () => {
  it("returns only the checked boxes posting under the given name", () => {
    // The name is a Rails array name; its brackets have to survive into the regex.
    const html =
      `<input type="checkbox" name="external_reports[]" value="7" checked="checked">` +
      `<input type="checkbox" name="external_reports[]" value="8">` +
      `<input type="checkbox" name="external_reports[]" value="9" checked="checked">` +
      `<input type="checkbox" name="other_reports[]" value="10" checked="checked">`;
    expect(readCheckedValues(html, "external_reports[]")).toEqual(["7", "9"]);
  });

  it("returns nothing when the page has no such checkboxes", () => {
    // What an unauthorized GET yields, since fetch follows the portal's redirect and hands
    // back some other page with a 200. attachReport re-reads and fails rather than
    // reporting a successful attach off the back of this.
    expect(readCheckedValues(`<h1>Sign in</h1>`, "external_reports[]")).toEqual([]);
  });
});

describe("readAdminIndexIds", () => {
  it("collects each id once, in ascending order", () => {
    // An index row links to the same record several times (show, edit, destroy), and the
    // rows are not necessarily in id order.
    const html =
      `<a href="/admin/clients/12">Show</a><a href="/admin/clients/12/edit">Edit</a>` +
      `<a href="/admin/clients/3">Show</a><a href="/admin/clients/3/edit">Edit</a>`;
    expect(readAdminIndexIds(html, "admin/clients")).toEqual([3, 12]);
  });

  it("ignores links to other resources", () => {
    const html = `<a href="/admin/clients/12">Show</a><a href="/admin/external_reports/99">Report</a>`;
    expect(readAdminIndexIds(html, "admin/clients")).toEqual([12]);
  });
});

describe("findAuthenticityToken", () => {
  it("finds the CSRF token whichever order Rails writes the attributes in", () => {
    expect(findAuthenticityToken(`<input name="authenticity_token" value="abc123" />`)).toBe("abc123");
    expect(findAuthenticityToken(`<input value="abc123" name="authenticity_token" />`)).toBe("abc123");
  });

  it("returns undefined when the page carries no token", () => {
    expect(findAuthenticityToken(`<form></form>`)).toBeUndefined();
  });
});
