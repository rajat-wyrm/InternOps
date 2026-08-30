const { URL } = require('url');
const dns = require('dns').promises;
const net = require('net');

const { ALLOWED_DOMAINS } = require('../../config/crawler-allowlist');
const { getAdapterForDomain } = require('./platform-adapters');

const FETCH_TIMEOUT_MS = 10000;
const MAX_CONTENT_LENGTH = 2 * 1024 * 1024;

function isAllowedDomain(hostname) {
  const normalizedHostname = hostname.toLowerCase().trim();

  return ALLOWED_DOMAINS.some(
    (domain) =>
      normalizedHostname === domain || normalizedHostname.endsWith(`.${domain}`)
  );
}

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;

  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 127 ||
    (a === 169 && b === 254)
  );
}

function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase();

  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

function isPrivateOrInternalIP(ip) {
  const version = net.isIP(ip);

  if (version === 4) {
    return isPrivateIPv4(ip);
  }

  if (version === 6) {
    return isPrivateIPv6(ip);
  }

  return true;
}

async function resolveAndValidateHostname(hostname) {
  const normalizedHostname = hostname.toLowerCase().trim();

  if (
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost')
  ) {
    return false;
  }

  const addresses = await dns.lookup(normalizedHostname, {
    all: true,
    verbatim: true,
  });

  if (!addresses.length) {
    return false;
  }

  return addresses.every(({ address }) => !isPrivateOrInternalIP(address));
}

async function fetchProofContent(url) {
  if (typeof url !== 'string' || !url.trim()) {
    return {
      success: false,
      error: 'A valid proof URL is required',
    };
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      success: false,
      error: 'Invalid proof URL',
    };
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return {
      success: false,
      error: 'Only HTTP and HTTPS URLs are supported',
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (!isAllowedDomain(hostname)) {
    return {
      success: false,
      error: 'Proof URL domain is not allowed',
    };
  }

  try {
    const isSafeHost = await resolveAndValidateHostname(hostname);

    if (!isSafeHost) {
      return {
        success: false,
        error: 'Proof URL resolves to a private or internal IP address',
      };
    }
  } catch {
    return {
      success: false,
      error: 'Unable to resolve proof URL hostname',
    };
  }

  const adapter = getAdapterForDomain(hostname);

  if (!adapter) {
    return {
      success: false,
      error: 'No crawler adapter is available for this domain',
    };
  }

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsedUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'InternOps-ProofCrawler/1.0',
      },
      redirect: 'manual',
      signal: controller.signal,
    });

    if (response.status >= 300 && response.status < 400) {
      return {
        success: false,
        error: 'Redirected proof URLs are not supported',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch proof URL: HTTP ${response.status}`,
      };
    }

    const contentType = response.headers.get('content-type') || '';

    if (!contentType.includes('text/html')) {
      return {
        success: false,
        error: 'Proof URL did not return HTML content',
      };
    }

    const contentLength = response.headers.get('content-length');

    if (
      contentLength &&
      Number.parseInt(contentLength, 10) > MAX_CONTENT_LENGTH
    ) {
      return {
        success: false,
        error: 'Proof page is too large to process',
      };
    }

    const rawHtml = await response.text();

    if (Buffer.byteLength(rawHtml, 'utf8') > MAX_CONTENT_LENGTH) {
      return {
        success: false,
        error: 'Proof page is too large to process',
      };
    }

    const parsed = adapter.parse(rawHtml);

    if (!parsed) {
      return {
        success: false,
        error: 'Unable to extract proof content',
      };
    }

    const content = JSON.stringify({
      text: parsed.text,
      comments: parsed.comments,
      visibleSignals: parsed.visibleSignals,
    });

    return {
      success: true,
      content,
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Proof URL request timed out',
      };
    }

    return {
      success: false,
      error: 'Unable to fetch proof URL',
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  fetchProofContent,
};
