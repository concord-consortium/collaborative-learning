import { parse } from "query-string";
import { processUrlParams } from "./url-params";

describe("urlParams", () => {
  // In Jest 30/jsdom, use jsdom's reconfigure method to change the URL
  const originalHref = window.location.href;

  const setLocation = (url: string) => {
    (global as any).jsdom.reconfigure({ url });
  };

  const setQueryParams = (params?: string) => {
    setLocation(`https://concord.org${params ? `?${params}` : ""}`);
  };

  const processQueryParams = (params?: string) => {
    setQueryParams(params);
    return processUrlParams();
  };

  afterEach(() => {
    setLocation(originalHref);
  });

  test("appMode must be valid", () => {
    expect(processQueryParams().appMode).toBeUndefined();
    expect(processQueryParams("appMode").appMode).toBeUndefined();
    expect(processQueryParams("appMode=bogus").appMode).toBeUndefined();
    expect(processQueryParams("appMode=dev").appMode).toBe("dev");
    expect(processQueryParams("appMode=authed").appMode).toBe("authed");
  });

  test("boolean params are true without a value", () => {
    expect(processQueryParams().demo).toBe(false);
    expect(processQueryParams("demo").demo).toBe(true);
    expect(processQueryParams("demo=true").demo).toBe(true);
    expect(processQueryParams("demo=yes").demo).toBe(true);
    expect(processQueryParams("demo=false").demo).toBe(false);
  });
});

describe("query-string parse", () => {
  it("returns null for a param without a value", () => {
    const result = parse("?foo&bar=1");
    expect(result.foo).toBeDefined();
    expect(result.foo).toBe(null);
    expect(result.bar).toBe("1");
  });
});
