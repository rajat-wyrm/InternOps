const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const {
  ALLOWED_DOMAINS: DEFAULT_ALLOWED_DOMAINS,
} = require('../../config/crawler-allowlist');

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_REDIRECTS = 5;

/**
 * Validates whether a hostname belongs to the allowed domains list.
 * Supports exact domain matches and legitimate subdomains (e.g., www.twitter.com).
 * Prevents suffix/prefix domain spoofing (e.g. evil-twitter.com or twitter.com.evil.com).
 *
 * @param {string} hostname - The hostname to validate.
 * @param {string[]} allowedDomains - The list of allowed domains.
 * @returns {boolean} True if allowed, false otherwise.
 */
function isDomainAllowed(hostname, allowedDomains) {
  if (!hostname || typeof hostname !== 'string') {
    return false;
  }

  const cleanHost = hostname.toLowerCase().trim();
  if (
    !cleanHost ||
    !Array.isArray(allowedDomains) ||
    allowedDomains.length === 0
  ) {
    return false;
  }

  return allowedDomains.some((allowed) => {
    if (!allowed || typeof allowed !== 'string') return false;
    const cleanAllowed = allowed.toLowerCase().trim().replace(/^\./, '');
    if (!cleanAllowed) return false;

    return cleanHost === cleanAllowed || cleanHost.endsWith(`.${cleanAllowed}`);
  });
}

/**
 * Checks whether an IPv4 address belongs to a private, loopback, link-local,
 * multicast, broadcast, or reserved range (SSRF protection).
 *
 * @param {string} ip - Dotted-quad IPv4 string.
 * @returns {boolean} True if private/restricted, false if public.
 */
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }

  const [a, b, c] = parts;

  // 0.0.0.0/8 - Current network (RFC 1122)
  if (a === 0) return true;

  // 10.0.0.0/8 - Private-Use (RFC 1918)
  if (a === 10) return true;

  // 100.64.0.0/10 - Shared Address Space / CGNAT (RFC 6598)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 127.0.0.0/8 - Loopback (RFC 1122)
  if (a === 127) return true;

  // 169.254.0.0/16 - Link-Local & Cloud Metadata (RFC 3927)
  if (a === 169 && b === 254) return true;

  // 172.16.0.0/12 - Private-Use (RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.0.0.0/24 - IETF Protocol Assignments (RFC 6890)
  if (a === 192 && b === 0 && c === 0) return true;

  // 192.0.2.0/24 - TEST-NET-1 (RFC 5737)
  if (a === 192 && b === 0 && c === 2) return true;

  // 192.168.0.0/16 - Private-Use (RFC 1918)
  if (a === 192 && b === 168) return true;

  // 198.18.0.0/15 - Benchmarking (RFC 2544)
  if (a === 198 && (b === 18 || b === 19)) return true;

  // 198.51.100.0/24 - TEST-NET-2 (RFC 5737)
  if (a === 198 && b === 51 && c === 100) return true;

  // 203.0.113.0/24 - TEST-NET-3 (RFC 5737)
  if (a === 203 && b === 0 && c === 113) return true;

  // 224.0.0.0/4 - Multicast (RFC 5771) & 240.0.0.0/4 - Reserved/Broadcast (RFC 1112/919)
  if (a >= 224) return true;

  return false;
}

/**
 * Checks whether an IPv6 address belongs to a private, loopback, link-local,
 * ULA, multicast, IPv4-mapped, or reserved range (SSRF protection).
 *
 * @param {string} ip - IPv6 string.
 * @returns {boolean} True if private/restricted, false if public.
 */
function isPrivateIPv6(ip) {
  let normalized = ip.toLowerCase().trim();

  // Strip zone index if present (e.g. fe80::1%eth0)
  if (normalized.includes('%')) {
    normalized = normalized.split('%')[0];
  }

  // Handle IPv4-mapped IPv6 (e.g. ::ffff:192.168.1.1)
  const ipv4MappedMatch = normalized.match(
    /(?:^|:)(?:ffff:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/
  );
  if (ipv4MappedMatch) {
    return isPrivateIPv4(ipv4MappedMatch[1]);
  }

  // IPv6 Unspecified (::)
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') {
    return true;
  }

  // IPv6 Loopback (::1)
  if (normalized === '::1') {
    return true;
  }
  const hexSegments = normalized.split(':');
  if (
    hexSegments.every((seg, idx) =>
      idx === hexSegments.length - 1
        ? seg === '1' || seg === '0001'
        : seg === '' || seg === '0' || seg === '0000'
    )
  ) {
    return true;
  }

  // Unique Local Address (ULA) - fc00::/7 (fc00:... to fdff:...)
  if (/^f[cd][0-9a-f]{0,2}:/i.test(normalized) || /^f[cd]/i.test(normalized)) {
    return true;
  }

  // Link-Local Unicast - fe80::/10 (fe80:... to febf:...)
  if (
    /^fe[89ab][0-9a-f]{0,2}:/i.test(normalized) ||
    /^fe[89ab]/i.test(normalized)
  ) {
    return true;
  }

  // Multicast - ff00::/8
  if (/^ff[0-9a-f]{0,2}:/i.test(normalized) || /^ff/i.test(normalized)) {
    return true;
  }

  // Discard-Only prefix - 100::/64
  if (normalized.startsWith('100:') || normalized.startsWith('0100:')) {
    return true;
  }

  // Documentation prefix - 2001:db8::/32
  if (
    normalized.startsWith('2001:db8:') ||
    normalized.startsWith('2001:0db8:')
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether an IP address is private or restricted.
 *
 * @param {string} ip - IP address string.
 * @returns {boolean} True if private/restricted, false if public.
 */
function isPrivateOrRestrictedIP(ip) {
  if (!ip || typeof ip !== 'string') return true;

  const trimmed = ip.trim();
  const family = net.isIP(trimmed);
  if (family === 0) return true;
  if (family === 4) return isPrivateIPv4(trimmed);
  if (family === 6) return isPrivateIPv6(trimmed);

  return true;
}

/**
 * Resolves a hostname via DNS and validates that ALL resolved IP addresses
 * are safe, public IPs (protecting against multi-record SSRF and DNS rebinding).
 *
 * @param {string} hostname - The hostname to resolve.
 * @param {Function} [dnsLookupFn] - Optional custom DNS resolver for testing.
 * @param {boolean} [allowLocalhostForTesting=false] - Testing flag to permit loopback in test harnesses.
 * @returns {Promise<{ addresses: Array<{address: string, family: number}>, error?: string }>}
 */
async function resolveAndValidateHostname(
  hostname,
  dnsLookupFn = null,
  allowLocalhostForTesting = false
) {
  const cleanHost = hostname.toLowerCase().trim();

  // If the hostname itself is a raw IP literal
  if (net.isIP(cleanHost) !== 0) {
    if (!allowLocalhostForTesting && isPrivateOrRestrictedIP(cleanHost)) {
      return {
        addresses: [],
        error: 'Access to private or restricted IP address is blocked',
      };
    }
    return {
      addresses: [
        {
          address: cleanHost,
          family: net.isIP(cleanHost),
        },
      ],
    };
  }

  // Resolve hostname via DNS
  try {
    const lookupFn = dnsLookupFn || dns.lookup;
    const results = await lookupFn(cleanHost, { all: true });
    const records = Array.isArray(results) ? results : [results];

    if (!records || records.length === 0 || !records[0].address) {
      return { addresses: [], error: `DNS resolution failed for ${cleanHost}` };
    }

    for (const record of records) {
      if (!record.address) {
        return {
          addresses: [],
          error: 'Access to private or restricted IP address is blocked',
        };
      }

      if (
        !allowLocalhostForTesting &&
        isPrivateOrRestrictedIP(record.address)
      ) {
        return {
          addresses: [],
          error: 'Access to private or restricted IP address is blocked',
        };
      }
    }

    return { addresses: records };
  } catch (err) {
    return {
      addresses: [],
      error: `DNS resolution failed for ${cleanHost}: ${err.message}`,
    };
  }
}

/**
 * Performs a single HTTP/HTTPS GET request against a pre-validated IP address,
 * enforcing response stream size limits, timeouts, and DNS-rebinding protection.
 *
 * @param {URL} targetUrl - Parsed URL to fetch.
 * @param {{ address: string, family: number }} targetIp - Pre-validated destination IP.
 * @param {object} options - Request options (timeout, maxSize).
 * @returns {Promise<{ statusCode: number, headers: object, content: string }>}
 */
function makeSingleRequest(targetUrl, targetIp, options) {
  return new Promise((resolve, reject) => {
    const isHttps = targetUrl.protocol === 'https:';
    const client = isHttps ? https : http;
    const defaultPort = isHttps ? 443 : 80;
    const port = targetUrl.port ? parseInt(targetUrl.port, 10) : defaultPort;

    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const maxSizeBytes = options.maxSize ?? DEFAULT_MAX_SIZE_BYTES;

    let isSettled = false;
    let timer = null;

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const reqOptions = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port,
      path: targetUrl.pathname + targetUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'InternOps-ProofCrawler/1.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      // Pass custom lookup to pin socket connection directly to validated IP (prevents DNS rebinding)
      lookup: (host, optionsOrCb, maybeCb) => {
        const callback =
          typeof optionsOrCb === 'function' ? optionsOrCb : maybeCb;
        const opts = typeof optionsOrCb === 'object' ? optionsOrCb : {};
        const family =
          targetIp.family || (net.isIP(targetIp.address) === 6 ? 6 : 4);
        if (typeof callback === 'function') {
          if (opts && opts.all) {
            callback(null, [{ address: targetIp.address, family }]);
          } else {
            callback(null, targetIp.address, family);
          }
        }
      },
    };

    if (isHttps) {
      reqOptions.servername = targetUrl.hostname;
    }

    const req = client.request(reqOptions, (res) => {
      // Check Content-Length header early if available
      const contentLengthHeader = res.headers['content-length'];
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(contentLength) && contentLength > maxSizeBytes) {
          isSettled = true;
          cleanup();
          req.destroy();
          res.destroy();
          reject(new Error('Response size limit exceeded'));
          return;
        }
      }

      let totalBytes = 0;
      const chunks = [];

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > maxSizeBytes) {
          isSettled = true;
          cleanup();
          req.destroy();
          res.destroy();
          reject(new Error('Response size limit exceeded'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        const content = Buffer.concat(chunks).toString('utf8');
        resolve({
          statusCode: res.statusCode || 200,
          headers: res.headers,
          content,
        });
      });

      res.on('error', (err) => {
        if (isSettled) return;
        isSettled = true;
        cleanup();
        reject(err);
      });
    });

    req.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      reject(err);
    });

    // Request timeout handling
    timer = setTimeout(() => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      req.destroy();
      reject(new Error('Request timed out'));
    }, timeoutMs);

    req.end();
  });
}

/**
 * Fetches proof content from a public URL with strict security controls:
 * - URL and protocol validation (only http and https)
 * - Domain allowlist verification (exact and subdomain matching)
 * - SSRF protection (DNS resolution with private/loopback/cloud-metadata filtering)
 * - DNS rebinding mitigation
 * - Stream-based response size limit enforcement
 * - Request timeout enforcement
 * - Safe redirect handling (independent validation at every hop)
 *
 * @param {string} url - The URL to fetch proof content from.
 * @param {object} [options] - Optional configurations (allowedDomains, timeout, maxSize, maxRedirects, dnsLookup).
 * @returns {Promise<{success: boolean, content?: string, error?: string}>} The proof content fetch result.
 */
async function fetchProofContent(url, options = {}) {
  try {
    if (!url || typeof url !== 'string' || !url.trim()) {
      return {
        success: false,
        error: 'Invalid URL: URL must be a non-empty string',
      };
    }

    const allowedDomains = options.allowedDomains || DEFAULT_ALLOWED_DOMAINS;
    const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    const visitedUrls = new Set();

    let currentUrlString = url.trim();
    let redirectCount = 0;

    while (redirectCount <= maxRedirects) {
      let parsedUrl;
      try {
        parsedUrl = new URL(currentUrlString);
      } catch {
        return { success: false, error: 'Invalid or malformed URL' };
      }

      // 1. Protocol validation
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return {
          success: false,
          error: `Unsupported protocol: ${parsedUrl.protocol}`,
        };
      }

      // 2. Hostname validation
      const hostname = parsedUrl.hostname;
      if (!hostname) {
        return { success: false, error: 'Missing hostname in URL' };
      }

      // 3. Domain allowlist validation
      if (!isDomainAllowed(hostname, allowedDomains)) {
        return {
          success: false,
          error: `Domain not allowed: ${hostname}`,
        };
      }

      // 4. DNS resolution and SSRF IP validation
      const dnsResult = await resolveAndValidateHostname(
        hostname,
        options.dnsLookup,
        options._allowLocalhostForTesting || false
      );
      if (
        dnsResult.error ||
        !dnsResult.addresses ||
        dnsResult.addresses.length === 0
      ) {
        return {
          success: false,
          error: dnsResult.error || `DNS resolution failed for ${hostname}`,
        };
      }

      const targetIp = dnsResult.addresses[0];

      // Track visited URL for cycle detection
      visitedUrls.add(currentUrlString);

      // 5. Perform HTTP/HTTPS request
      let response;
      try {
        response = await makeSingleRequest(parsedUrl, targetIp, options);
      } catch (reqErr) {
        return {
          success: false,
          error: reqErr.message || 'Network request failed',
        };
      }

      // 6. Redirect handling (301, 302, 303, 307, 308)
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        redirectCount++;
        if (redirectCount > maxRedirects) {
          return { success: false, error: 'Too many redirects' };
        }

        let nextUrl;
        try {
          nextUrl = new URL(
            response.headers.location,
            currentUrlString
          ).toString();
        } catch {
          return { success: false, error: 'Invalid redirect Location URL' };
        }

        if (visitedUrls.has(nextUrl)) {
          return { success: false, error: 'Redirect loop detected' };
        }

        currentUrlString = nextUrl;
        continue;
      }

      // 7. Non-2xx HTTP status codes
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return {
          success: false,
          error: `HTTP error ${response.statusCode}`,
        };
      }

      // 8. Successful response
      return {
        success: true,
        content: response.content,
      };
    }

    return { success: false, error: 'Too many redirects' };
  } catch (err) {
    return {
      success: false,
      error:
        err.message || 'Unexpected error occurred while fetching proof content',
    };
  }
}

module.exports = {
  fetchProofContent,
  isDomainAllowed,
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateOrRestrictedIP,
  resolveAndValidateHostname,
};
