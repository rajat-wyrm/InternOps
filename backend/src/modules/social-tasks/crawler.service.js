const { URL } = require('url');
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
