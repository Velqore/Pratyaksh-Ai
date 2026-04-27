// Indicator-of-compromise extraction. Run regexes against extracted strings
// to surface IPs, domains, URLs, emails, crypto wallet addresses, and hashes.

export interface IOCs {
  ipv4: string[];
  ipv6: string[];
  urls: string[];
  domains: string[];
  emails: string[];
  bitcoin: string[];
  ethereum: string[];
  md5: string[];
  sha1: string[];
  sha256: string[];
  registryKeys: string[];
  filePaths: string[];
}

// Non-global ipv4 matcher used for stateless membership tests inside loops.
// Calling `.test()` on a `/g` regex mutates `lastIndex`, so we keep a
// dedicated stateless copy for the domain-vs-IP filter.
const IPV4_TEST = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const PATTERNS = {
  ipv4: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  urls: /\bhttps?:\/\/[^\s<>"'()]{3,256}/gi,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  domain: /\b(?=.{4,253}\b)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?){1,})\b/gi,
  bitcoin: /\b(?:bc1[a-z0-9]{25,89}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g,
  ethereum: /\b0x[a-fA-F0-9]{40}\b/g,
  md5: /\b[a-f0-9]{32}\b/gi,
  sha1: /\b[a-f0-9]{40}\b/gi,
  sha256: /\b[a-f0-9]{64}\b/gi,
  registryKey: /\bHK(?:LM|CU|CR|U|CC)\\[A-Za-z0-9_\\.\- ]{3,200}/g,
  filePath: /\b(?:[A-Z]:\\|\/(?:home|var|etc|usr|tmp|opt))[A-Za-z0-9_\-./\\ ]{3,200}/g,
};

const TLD_DENYLIST = new Set([
  "json",
  "xml",
  "html",
  "txt",
  "md",
  "log",
  "css",
  "js",
  "ts",
  "tsx",
  "jsx",
  "exe",
  "dll",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
  "py",
  "rb",
  "sh",
]);

function dedup(arr: string[]): string[] {
  return Array.from(new Set(arr));
}

export function extractIOCs(text: string): IOCs {
  const ipv4 = dedup(text.match(PATTERNS.ipv4) || []);
  const ipv6 = dedup(text.match(PATTERNS.ipv6) || []);
  const urls = dedup(text.match(PATTERNS.urls) || []).slice(0, 100);
  const emails = dedup(text.match(PATTERNS.email) || []).slice(0, 100);
  const domainsRaw = dedup(text.match(PATTERNS.domain) || []);
  const domains = domainsRaw
    .filter((d) => {
      const tld = d.split(".").pop()?.toLowerCase() ?? "";
      if (TLD_DENYLIST.has(tld)) return false;
      // Exclude version-y strings like 1.2.3 (all-numeric labels)
      if (/^[0-9.]+$/.test(d)) return false;
      // Exclude IPs (already in ipv4) — use stateless matcher.
      if (IPV4_TEST.test(d)) return false;
      return tld.length >= 2 && tld.length <= 24;
    })
    .slice(0, 100);
  const bitcoin = dedup(text.match(PATTERNS.bitcoin) || []);
  const ethereum = dedup(text.match(PATTERNS.ethereum) || []);
  const sha256 = dedup(text.match(PATTERNS.sha256) || []);
  // Avoid double-counting: a 64-char string that matched sha256 also matches sha1/md5
  const sha1 = dedup(text.match(PATTERNS.sha1) || []).filter(
    (h) => !sha256.includes(h),
  );
  const md5 = dedup(text.match(PATTERNS.md5) || []).filter(
    (h) => !sha256.includes(h) && !sha1.includes(h),
  );
  const registryKeys = dedup(text.match(PATTERNS.registryKey) || []).slice(0, 50);
  const filePaths = dedup(text.match(PATTERNS.filePath) || []).slice(0, 50);

  return {
    ipv4,
    ipv6,
    urls,
    domains,
    emails,
    bitcoin,
    ethereum,
    md5,
    sha1,
    sha256,
    registryKeys,
    filePaths,
  };
}

export function summarizeIOCs(iocs: IOCs): string[] {
  const out: string[] = [];
  if (iocs.ipv4.length) out.push(`${iocs.ipv4.length} IPv4 address(es)`);
  if (iocs.ipv6.length) out.push(`${iocs.ipv6.length} IPv6 address(es)`);
  if (iocs.urls.length) out.push(`${iocs.urls.length} URL(s)`);
  if (iocs.emails.length) out.push(`${iocs.emails.length} email address(es)`);
  if (iocs.domains.length) out.push(`${iocs.domains.length} domain(s)`);
  if (iocs.bitcoin.length)
    out.push(`${iocs.bitcoin.length} Bitcoin address(es)`);
  if (iocs.ethereum.length)
    out.push(`${iocs.ethereum.length} Ethereum address(es)`);
  if (iocs.md5.length) out.push(`${iocs.md5.length} MD5 hash reference(s)`);
  if (iocs.sha1.length) out.push(`${iocs.sha1.length} SHA-1 hash reference(s)`);
  if (iocs.sha256.length)
    out.push(`${iocs.sha256.length} SHA-256 hash reference(s)`);
  if (iocs.registryKeys.length)
    out.push(`${iocs.registryKeys.length} Windows registry key(s)`);
  if (iocs.filePaths.length)
    out.push(`${iocs.filePaths.length} suspicious file path(s)`);
  return out;
}
