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

  it("appMode must be valid", () => {
    expect(processQueryParams().appMode).toBeUndefined();
    expect(processQueryParams("appMode").appMode).toBeUndefined();
    expect(processQueryParams("appMode=bogus").appMode).toBeUndefined();
    expect(processQueryParams("appMode=dev").appMode).toBe("dev");
    expect(processQueryParams("appMode=authed").appMode).toBe("authed");
  });

  it("demo param accepts but does not require value", () => {
    expect(processQueryParams().demo).toBe(false);
    expect(processQueryParams("demo").demo).toBe(true);
    expect(processQueryParams("demo=true").demo).toBe(true);
    expect(processQueryParams("demo=yes").demo).toBe(true);
  });
});
