import {
  createRtdbReader, parseSpacesFilter, resolveDatabaseUrl, selectSpaces
} from "./repair-cli";

describe("parseSpacesFilter", () => {
  it("is undefined when unset, meaning every space", () => {
    expect(parseSpacesFilter(undefined)).toBeUndefined();
    expect(parseSpacesFilter("")).toBeUndefined();
    expect(parseSpacesFilter("  ,  ")).toBeUndefined();
  });

  it("accepts a comma separated list, trimming whitespace", () => {
    expect(parseSpacesFilter("demo/CLUE, authed/learn_concord_org"))
      .toEqual(["demo/CLUE", "authed/learn_concord_org"]);
  });
});

describe("selectSpaces", () => {
  const paths = [
    "authed/learn_concord_org/documents",
    "demo/CLUE-Test/documents",
    "qa/someRoot/documents",
    "nosuchroot/x/documents"
  ];

  it("resolves the runnable spaces and buckets the rest by why they were left out", () => {
    const result = selectSpaces(paths);

    expect(result.selected).toEqual([
      { label: "authed/learn_concord_org", spacePath: "authed/learn_concord_org/documents",
        rtdbRoot: "/authed/portals/learn_concord_org" },
      { label: "demo/CLUE-Test", spacePath: "demo/CLUE-Test/documents",
        rtdbRoot: "/demo/CLUE-Test/portals/demo" }
    ]);
    expect(result.refused.map(r => r.label)).toEqual(["qa/someRoot"]);
    expect(result.unrecognized).toEqual(["nosuchroot/x/documents"]);
  });

  it("keeps only the named spaces when a filter is given", () => {
    const result = selectSpaces(paths, ["demo/CLUE-Test"]);

    expect(result.selected.map(s => s.label)).toEqual(["demo/CLUE-Test"]);
    expect(result.filteredOut).toBe(1);
  });

  it("refuses qa even when it is named explicitly", () => {
    // Naming a space should not be able to override the refusal: qa's realtime side is purged, so a
    // creation run there would invent thousands of rows for content that no longer exists.
    const result = selectSpaces(paths, ["qa/someRoot"]);

    expect(result.selected).toEqual([]);
    expect(result.refused.map(r => r.label)).toEqual(["qa/someRoot"]);
  });

  it("reports a filter naming a space that does not exist, rather than running nothing quietly", () => {
    const result = selectSpaces(paths, ["demo/Typo"]);

    expect(result.selected).toEqual([]);
    expect(result.filterMisses).toEqual(["demo/Typo"]);
  });
});

describe("createRtdbReader", () => {
  const token = async () => ({ access_token: "tok" });

  it("asks for child keys only, so a shallow read never pulls a subtree", async () => {
    const urls: string[] = [];
    const reader = createRtdbReader("https://db.example.com", token as any, {
      fetch: async (url: string) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => ({ a: true, b: true }) } as any;
      }
    });

    expect(await reader.readChildKeys("/authed/portals/p/classes")).toEqual(["a", "b"]);
    expect(urls[0]).toBe("https://db.example.com/authed/portals/p/classes.json?shallow=true&access_token=tok");
  });

  it("escapes each path segment, so a portal named localhost:3000 is addressable", async () => {
    const urls: string[] = [];
    const reader = createRtdbReader("https://db.example.com", token as any, {
      fetch: async (url: string) => {
        urls.push(url);
        return { ok: true, status: 200, json: async () => null } as any;
      }
    });

    await reader.readNode("/authed/portals/localhost:3000/classes/c1");

    expect(urls[0]).toContain("/authed/portals/localhost%3A3000/classes/c1.json");
    expect(urls[0]).not.toContain("shallow=true");
  });

  it("returns an empty list for a node that is absent", async () => {
    const reader = createRtdbReader("https://db.example.com", token as any, {
      fetch: async () => ({ ok: true, status: 200, json: async () => null }) as any
    });

    expect(await reader.readChildKeys("/nothing/here")).toEqual([]);
    expect(await reader.readNode("/nothing/here")).toBeNull();
  });

  it("refreshes the token and retries once when the database rejects it", async () => {
    // A long sweep outlives its access token; without this the run dies partway through.
    let calls = 0;
    let issued = 0;
    const reader = createRtdbReader("https://db.example.com",
      (async () => ({ access_token: `tok${++issued}` })) as any,
      {
        fetch: async (url: string) => {
          calls++;
          if (calls === 1) return { ok: false, status: 401, json: async () => null } as any;
          expect(url).toContain("access_token=tok2");
          return { ok: true, status: 200, json: async () => ({ x: true }) } as any;
        }
      });

    expect(await reader.readChildKeys("/p")).toEqual(["x"]);
    expect(calls).toBe(2);
  });

  it("throws after repeated failures rather than reporting an empty space", async () => {
    // Returning [] on a persistent error would read as "this space has no documents", and a repair
    // run would report a clean sweep having looked at nothing.
    const reader = createRtdbReader("https://db.example.com", token as any, {
      fetch: async () => ({ ok: false, status: 500, json: async () => null }) as any
    });

    await expect(reader.readChildKeys("/p")).rejects.toThrow(/500/);
  });
});

describe("resolveDatabaseUrl", () => {
  it("looks the URL up from the credential's project", () => {
    expect(resolveDatabaseUrl("collaborative-learning-ec215"))
      .toBe("https://collaborative-learning-ec215.firebaseio.com");
    expect(resolveDatabaseUrl("collaborative-learning-staging"))
      .toBe("https://collaborative-learning-staging-default-rtdb.firebaseio.com");
  });

  it("throws for an unknown project rather than guessing a host", () => {
    // The two projects share no host pattern, so a derived URL would be a plausible guess pointing at
    // nothing -- or worse, at another environment, whose offerings would be read onto these documents.
    expect(() => resolveDatabaseUrl("some-other-project")).toThrow(/some-other-project/);
    expect(() => resolveDatabaseUrl("some-other-project")).toThrow(/DATABASE_URL/);
  });

  it("prefers an explicit override, for an environment not listed", () => {
    expect(resolveDatabaseUrl("anything", "https://example.firebaseio.com"))
      .toBe("https://example.firebaseio.com");
  });
});

describe("createRtdbReader network resilience", () => {
  const token = async () => ({ access_token: "tok" });
  const noDelay = async () => undefined;

  it("retries when fetch itself throws, rather than losing the whole sweep to a DNS blip", async () => {
    // A full sweep makes tens of thousands of requests; a single transient ENOTFOUND killed one run
    // outright. Only a non-ok response was being retried, not a rejected fetch.
    let calls = 0;
    const reader = createRtdbReader("https://db.example.com", token as any, {
      delay: noDelay,
      fetch: async () => {
        if (++calls === 1) throw new Error("getaddrinfo ENOTFOUND db.example.com");
        return { ok: true, status: 200, json: async () => ({ a: true }) } as any;
      }
    });

    expect(await reader.readChildKeys("/p")).toEqual(["a"]);
    expect(calls).toBe(2);
  });

  it("gives up after repeated network failures, surfacing the last error", async () => {
    const reader = createRtdbReader("https://db.example.com", token as any, {
      delay: noDelay,
      fetch: async () => { throw new Error("ENOTFOUND"); }
    });

    await expect(reader.readChildKeys("/p")).rejects.toThrow(/ENOTFOUND/);
  });

  it("waits between attempts so a retry does not arrive during the same outage", async () => {
    const waits: number[] = [];
    let calls = 0;
    const reader = createRtdbReader("https://db.example.com", token as any, {
      delay: async (ms: number) => { waits.push(ms); },
      fetch: async () => {
        if (++calls < 3) throw new Error("ENOTFOUND");
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }
    });

    await reader.readChildKeys("/p");

    expect(waits.length).toBe(2);
    expect(waits[1]).toBeGreaterThan(waits[0]);
  });
});
