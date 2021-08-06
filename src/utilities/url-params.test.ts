import { processUrlParams } from "./url-params";

describe("urlParams", () => {
  const originalLocation = window.location;

  const mockWindowLocation = (newLocation: Location | URL) => {
    delete (window as any).location;
    window.location = newLocation as Location;
  };

  const setLocation = (url: string) => {
    mockWindowLocation(new URL(url));
  };

  const setQueryParams = (params?: string) => {
    setLocation(`https://concord.org${params ? `?${params}` : ""}`);
  };

  const processQueryParams = (params?: string) => {
    setQueryParams(params);
    return processUrlParams();
  };

  afterEach(() => {
    mockWindowLocation(originalLocation);
  });

  it("appMode defaults to dev but can be overridden", () => {
    expect(processQueryParams().appMode).toBe("dev");
    expect(processQueryParams("appMode").appMode).toBe("dev");
    expect(processQueryParams("appMode=bogus").appMode).toBe("dev");
    expect(processQueryParams("appMode=authed").appMode).toBe("authed");
  });

  it("demo param accepts but does not require value", () => {
    expect(processQueryParams().demo).toBe(false);
    expect(processQueryParams("demo").demo).toBe(true);
    expect(processQueryParams("demo=true").demo).toBe(true);
    expect(processQueryParams("demo=yes").demo).toBe(true);
  });

  it("chat param accepts but does not require value", () => {
    expect(processQueryParams().chat).toBe(false);
    expect(processQueryParams("chat").chat).toBe(true);
    expect(processQueryParams("chat=true").chat).toBe(true);
    expect(processQueryParams("chat=yes").chat).toBe(true);
    expect(processQueryParams("chat=fixtures").chat).toBe("fixtures");
  });
});
