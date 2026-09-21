import { isPublicHttpsUrl, isShutterbugImageHost, redirectDowngradeReason } from "./urls";

describe("isPublicHttpsUrl", () => {
  it("accepts a public https URL", () => {
    expect(isPublicHttpsUrl("https://images.example.test/shot.png")).toBe(true);
    expect(isPublicHttpsUrl("https://8.8.8.8/shot.png")).toBe(true);
  });

  it("refuses plain http and anything unparseable", () => {
    expect(isPublicHttpsUrl("http://images.example.test/shot.png")).toBe(false);
    expect(isPublicHttpsUrl("images.example.test/shot.png")).toBe(false);
  });

  it("refuses loopback and the private ranges, in both address families", () => {
    for (const host of [
      "localhost", "127.0.0.1", "127.1.2.3", "0.0.0.0", "10.0.0.5", "172.16.0.1", "172.31.255.255",
      "192.168.1.1", "169.254.169.254", "[::1]", "[::]", "[fd00::1]", "[fe80::1]",
      "[::ffff:127.0.0.1]",
      // Shared address space (RFC 6598), and both ends of it.
      "100.64.0.1", "100.127.255.255"
    ]) {
      expect({ host, allowed: isPublicHttpsUrl(`https://${host}/shot.png`) })
        .toEqual({ host, allowed: false });
    }
    // Just outside each private block, so the range checks are ranges and not prefix matches.
    for (const host of ["172.32.0.1", "100.63.255.255", "100.128.0.1"]) {
      expect({ host, allowed: isPublicHttpsUrl(`https://${host}/shot.png`) })
        .toEqual({ host, allowed: true });
    }
  });

  it("refuses a loopback name written with a trailing dot", () => {
    // `URL` keeps a trailing dot on a domain (it strips one on an IPv4 literal, which is why that
    // case is not here too), so "localhost." reaches the check as itself, dot included.
    expect(isPublicHttpsUrl("https://localhost./shot.png")).toBe(false);
    expect(isPublicHttpsUrl("https://sub.localhost./shot.png")).toBe(false);
    // A trailing dot on an ordinary public name is still just that name.
    expect(isPublicHttpsUrl("https://images.example.test./shot.png")).toBe(true);
  });

  it("reads only the IPv4-mapped form, which is the only one that reaches the address", () => {
    // `::ffff:0:127.0.0.1` and `::ffff:0:0:127.0.0.1` normalize to `[::ffff:0:7f00:1]` and
    // `[::ffff:0:0:7f00:1]`, which put `ffff` in a different group: the deprecated IPv4-translated
    // range, which no stack here translates — both answer EHOSTUNREACH rather than reaching
    // 127.0.0.1. Treating them as private would be reading an unreachable IPv6 address as loopback.
    expect(isPublicHttpsUrl("https://[::ffff:127.0.0.1]/shot.png")).toBe(false);
    expect(isPublicHttpsUrl("https://[::ffff:0:127.0.0.1]/shot.png")).toBe(true);
    expect(isPublicHttpsUrl("https://[::ffff:0:0:127.0.0.1]/shot.png")).toBe(true);
  });

  it("reads an IPv4 address however it is written", () => {
    // `URL` normalizes the decimal, hex, octal and short forms, so the octet check sees 127.0.0.1
    // in every case and none of them is a way around it.
    for (const host of ["2130706433", "0x7f000001", "017700000001", "127.1"]) {
      expect({ host, allowed: isPublicHttpsUrl(`https://${host}/shot.png`) })
        .toEqual({ host, allowed: false });
    }
  });
});

describe("redirectDowngradeReason", () => {
  it("refuses a redirect that lands somewhere less safe than where it was asked to go", () => {
    const from = "https://images.example.test/shot.png";
    expect(redirectDowngradeReason(from, from)).toBeNull();
    expect(redirectDowngradeReason(from, "https://cdn.example.test/shot.png")).toBeNull();
    expect(redirectDowngradeReason(from, "http://images.example.test/shot.png"))
      .toMatch(/not a public https URL/);
    expect(redirectDowngradeReason(from, "https://127.0.0.1:9/shot.png"))
      .toMatch(/not a public https URL/);
  });

  it("leaves a deliberately local URL alone, since it cannot be downgraded", () => {
    // The rule is "no worse than what was asked for". A caller deliberately pointing at a local
    // server has not been redirected anywhere they did not choose.
    expect(redirectDowngradeReason("http://127.0.0.1:9/a.png", "http://127.0.0.1:9/b.png")).toBeNull();
  });
});

describe("isShutterbugImageHost", () => {
  it("accepts an S3 host, bucket name and region aside", () => {
    expect(isShutterbugImageHost("https://ccshutterbug.s3.us-east-1.amazonaws.com/shot.png")).toBe(true);
    expect(isShutterbugImageHost("https://a-different-bucket.s3.amazonaws.com/shot.png")).toBe(true);
    expect(isShutterbugImageHost("https://amazonaws.com/shot.png")).toBe(true);
  });

  it("refuses a public https host that merely looks safe, and anything unparseable", () => {
    // Public and https, so isPublicHttpsUrl would accept it; this rejects it anyway, because it is
    // not Shutterbug's own host — a host name an attacker can register and point DNS at anything.
    expect(isShutterbugImageHost("https://images.example.test/shot.png")).toBe(false);
    expect(isShutterbugImageHost("https://notamazonaws.com/shot.png")).toBe(false);
    expect(isShutterbugImageHost("https://amazonaws.com.attacker.test/shot.png")).toBe(false);
    expect(isShutterbugImageHost("amazonaws.com/shot.png")).toBe(false);
  });
});
