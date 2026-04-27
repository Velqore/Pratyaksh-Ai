// Display-name spoofing + look-alike domain checks. Compares the display
// name of the sender against the address domain, computes Levenshtein
// distance against a built-in brand list, and surfaces ASCII / Punycode
// homograph attacks.

const BRANDS = [
  "google.com",
  "gmail.com",
  "microsoft.com",
  "outlook.com",
  "office365.com",
  "amazon.com",
  "apple.com",
  "icloud.com",
  "paypal.com",
  "facebook.com",
  "linkedin.com",
  "github.com",
  "dropbox.com",
  "salesforce.com",
  "zoom.us",
  "stripe.com",
  "okta.com",
  "adobe.com",
  "netflix.com",
  "wellsfargo.com",
  "chase.com",
  "bankofamerica.com",
];

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

export interface SpoofFinding {
  kind:
    | "display_name_spoof"
    | "reply_to_mismatch"
    | "punycode_domain"
    | "lookalike_brand"
    | "subdomain_brand";
  detail: string;
  similar?: string;
  distance?: number;
}

function domainOf(addr?: string): string {
  if (!addr) return "";
  const i = addr.lastIndexOf("@");
  return i === -1 ? "" : addr.slice(i + 1).toLowerCase();
}

export function checkSpoof(
  from?: { address?: string; name?: string },
  replyTo?: { address?: string; name?: string },
): SpoofFinding[] {
  const out: SpoofFinding[] = [];
  const fromDomain = domainOf(from?.address);
  const replyDomain = domainOf(replyTo?.address);

  // 1) Display-name embeds an email address whose domain doesn't match the From domain
  const nameAddrMatch = from?.name && /([\w.+-]+)@([\w.-]+)/.exec(from.name);
  if (nameAddrMatch) {
    const named = nameAddrMatch[2].toLowerCase();
    if (fromDomain && named !== fromDomain) {
      out.push({
        kind: "display_name_spoof",
        detail: `Display name "${from?.name}" claims @${named} but envelope is @${fromDomain}.`,
      });
    }
  }
  // 2) Reply-To domain mismatch (when both present)
  if (replyDomain && fromDomain && replyDomain !== fromDomain) {
    out.push({
      kind: "reply_to_mismatch",
      detail: `Reply-To uses @${replyDomain}; From uses @${fromDomain}.`,
    });
  }
  // 3) Punycode (xn--) domains
  if (fromDomain.includes("xn--")) {
    out.push({
      kind: "punycode_domain",
      detail: `From domain uses Punycode: ${fromDomain}.`,
    });
  }
  // 4) Look-alike brand domain (Levenshtein)
  if (fromDomain) {
    let best: { brand: string; dist: number } | null = null;
    for (const brand of BRANDS) {
      if (brand === fromDomain) continue;
      const d = levenshtein(fromDomain, brand);
      if (d > 0 && d <= 2 && (!best || d < best.dist)) {
        best = { brand, dist: d };
      }
    }
    if (best) {
      out.push({
        kind: "lookalike_brand",
        detail: `From domain ${fromDomain} differs from ${best.brand} by ${best.dist} edit(s).`,
        similar: best.brand,
        distance: best.dist,
      });
    }
    // 5) Brand name appears as a subdomain of another domain
    for (const brand of BRANDS) {
      const baseLabel = brand.split(".")[0];
      if (baseLabel.length < 5) continue;
      if (fromDomain.includes(`.${baseLabel}.`) && !fromDomain.endsWith(brand)) {
        out.push({
          kind: "subdomain_brand",
          detail: `From domain ${fromDomain} contains brand label "${baseLabel}" outside the legitimate ${brand} zone.`,
          similar: brand,
        });
        break;
      }
    }
  }

  return out;
}

export const KNOWN_BRANDS = BRANDS;
