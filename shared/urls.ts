/**
 * Whether a hosted URL is safe to fetch bytes from: public and https.
 *
 * A hosted URL can redirect to plain `http`, or to an address on the machine or network doing the
 * fetching — Shutterbug's own image URLs among them. Checking this against the *final* response
 * URL, not just the one that was requested, is what closes that: a silent downgrade or a landing
 * on the private network fails instead of being fetched and treated as trusted content.
 *
 * A public hostname that resolves to a private address still passes; stopping that needs the
 * resolved address, which `fetch` does not expose. The check is on the URL, and says so.
 */
export function isPublicHttpsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && !isPrivateHost(url.hostname);
}

/**
 * Why a redirect must not be followed, or `null` when it is fine.
 *
 * The rule is that a redirect may not land somewhere less safe than the URL that was asked for. A
 * request to a public https URL has to end at a public https URL; a caller who deliberately points
 * at a local server is not downgraded by ending up there, so that case is left alone. Stating it as
 * "no downgrade" rather than "https only" is what lets a local Shutterbug and loopback test servers
 * keep working while the case that matters — a hosted URL quietly redirecting to plain http, or to
 * an address on the machine making the request — still fails.
 *
 * This says nothing about a URL that was never public https to begin with, because there is no
 * downgrade in that case to describe. Whether such a URL should be fetched at all is a separate
 * question, settled where the URL is admitted rather than where it is followed.
 */
export function redirectDowngradeReason(requestedUrl: string, finalUrl: string): string | null {
  if (!isPublicHttpsUrl(requestedUrl) || isPublicHttpsUrl(finalUrl)) return null;
  return `redirected to ${finalUrl}, which is not a public https URL`;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  // `URL.hostname` returns IPv6 addresses bracketed.
  if (host.startsWith("[")) {
    const address = host.slice(1, -1);
    // Loopback and the unspecified address, then unique-local (fc00::/7) and link-local (fe80::/10).
    if (address === "::1" || address === "::") return true;
    if (/^f[cd]/.test(address) || /^fe[89ab]/.test(address)) return true;
    // An IPv4-mapped address is still the IPv4 address it names. `URL` normalizes the dotted form
    // (`::ffff:127.0.0.1`) to hex groups (`::ffff:7f00:1`), so that is the form to read.
    //
    // Only this form. `::ffff:0:127.0.0.1` and `::ffff:0:0:127.0.0.1` normalize just as readily, to
    // `::ffff:0:7f00:1` and `::ffff:0:0:7f00:1`, and are deliberately not matched: they put `ffff`
    // in a different group, which is the deprecated IPv4-translated range rather than the mapped
    // one. No stack here translates them — both answer EHOSTUNREACH rather than reaching 127.0.0.1
    // — so they are ordinary unreachable IPv6 addresses and reading them as private would be wrong.
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
    if (!mapped) return false;
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return isPrivateIpv4([high, low].flatMap((group) => [Math.floor(group / 256), group % 256]).join("."));
  }
  return isPrivateIpv4(host);
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  // Not four numbers: a name rather than an address, which this cannot judge.
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    // Shared address space (RFC 6598). Carrier-grade NAT, and the pod network on several managed
    // Kubernetes offerings — an address that routes somewhere internal rather than nowhere.
    (first === 100 && second >= 64 && second <= 127) ||
    // Link-local, which on a cloud host is the instance metadata service.
    (first === 169 && second === 254);
}
