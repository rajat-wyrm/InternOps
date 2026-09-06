const http = require('http');
const {
  fetchProofContent,
  isDomainAllowed,
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateOrRestrictedIP,
  resolveAndValidateHostname,
} = require('../../src/modules/social-tasks/crawler.service');

describe('Proof Crawler Service', () => {
  let server;
  let serverPort;

  beforeAll((done) => {
    // Local mock HTTP server for testing real HTTP handling
    server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://127.0.0.1:${serverPort}`);

      if (url.pathname === '/success') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body>Proof content verified</body></html>');
      } else if (url.pathname === '/empty') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('');
      } else if (url.pathname === '/error-500') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else if (url.pathname === '/error-404') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      } else if (url.pathname === '/slow') {
        // Delay response to test timeout abort
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('Delayed content');
          }
        }, 300);
      } else if (url.pathname === '/oversized-header') {
        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Content-Length': '10485760', // 10 MB header
        });
        res.end('data');
      } else if (url.pathname === '/oversized-stream') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        // Send stream chunks without Content-Length
        const chunk = 'X'.repeat(512);
        for (let i = 0; i < 20; i++) {
          res.write(chunk);
        }
        res.end();
      } else if (url.pathname === '/redirect-allowed') {
        res.writeHead(302, {
          Location: `http://twitter.com:${serverPort}/success`,
        });
        res.end();
      } else if (url.pathname === '/redirect-evil') {
        res.writeHead(302, {
          Location: 'http://evil.com/malicious',
        });
        res.end();
      } else if (url.pathname === '/redirect-localhost') {
        res.writeHead(302, {
          Location: 'http://127.0.0.1/internal-secret',
        });
        res.end();
      } else if (url.pathname === '/redirect-private-dns') {
        res.writeHead(302, {
          Location: `http://private.twitter.com:${serverPort}/secret`,
        });
        res.end();
      } else if (url.pathname === '/redirect-hop-1') {
        res.writeHead(302, {
          Location: `http://twitter.com:${serverPort}/redirect-hop-2`,
        });
        res.end();
      } else if (url.pathname === '/redirect-hop-2') {
        res.writeHead(302, {
          Location: `http://twitter.com:${serverPort}/success`,
        });
        res.end();
      } else if (url.pathname === '/redirect-loop-a') {
        res.writeHead(302, {
          Location: `http://twitter.com:${serverPort}/redirect-loop-b`,
        });
        res.end();
      } else if (url.pathname === '/redirect-loop-b') {
        res.writeHead(302, {
          Location: `http://twitter.com:${serverPort}/redirect-loop-a`,
        });
        res.end();
      } else if (url.pathname === '/redirect-excessive-1') {
        res.writeHead(302, {
          Location: `http://twitter.com:${serverPort}/redirect-excessive-2`,
        });
        res.end();
      } else if (url.pathname === '/redirect-excessive-2') {
        res.writeHead(302, {
          Location: `http://twitter.com:${serverPort}/redirect-excessive-3`,
        });
        res.end();
      } else if (url.pathname === '/redirect-excessive-3') {
        res.writeHead(302, {
          Location: `http://twitter.com:${serverPort}/success`,
        });
        res.end();
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      serverPort = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  // Helper to resolve hostnames to our local test server IP
  const localDnsMock = (targetIp = '127.0.0.1') => {
    return jest.fn().mockImplementation(async (hostname) => {
      if (hostname.startsWith('private.')) {
        return [{ address: '10.0.0.1', family: 4 }];
      }
      if (hostname.startsWith('metadata.')) {
        return [{ address: '169.254.169.254', family: 4 }];
      }
      if (hostname.startsWith('evil.')) {
        return [{ address: '93.184.216.34', family: 4 }];
      }
      return [{ address: targetIp, family: 4 }];
    });
  };

  describe('isDomainAllowed', () => {
    const allowed = ['twitter.com', 'x.com', 'linkedin.com'];

    test('allows exact domain matches', () => {
      expect(isDomainAllowed('twitter.com', allowed)).toBe(true);
      expect(isDomainAllowed('x.com', allowed)).toBe(true);
      expect(isDomainAllowed('linkedin.com', allowed)).toBe(true);
    });

    test('allows legitimate subdomains', () => {
      expect(isDomainAllowed('www.twitter.com', allowed)).toBe(true);
      expect(isDomainAllowed('api.twitter.com', allowed)).toBe(true);
      expect(isDomainAllowed('sub.domain.linkedin.com', allowed)).toBe(true);
    });

    test('is case insensitive', () => {
      expect(isDomainAllowed('TWITTER.COM', allowed)).toBe(true);
      expect(isDomainAllowed('Www.LinkedIn.Com', allowed)).toBe(true);
    });

    test('rejects attacker suffix domains', () => {
      expect(isDomainAllowed('evil-twitter.com', allowed)).toBe(false);
      expect(isDomainAllowed('notlinkedin.com', allowed)).toBe(false);
      expect(isDomainAllowed('x.com.evil.com', allowed)).toBe(false);
      expect(isDomainAllowed('twitter.com.attacker.org', allowed)).toBe(false);
    });

    test('rejects non-allowlisted domains', () => {
      expect(isDomainAllowed('facebook.com', allowed)).toBe(false);
      expect(isDomainAllowed('google.com', allowed)).toBe(false);
      expect(isDomainAllowed('localhost', allowed)).toBe(false);
    });

    test('handles empty or invalid inputs gracefully', () => {
      expect(isDomainAllowed('', allowed)).toBe(false);
      expect(isDomainAllowed(null, allowed)).toBe(false);
      expect(isDomainAllowed(undefined, allowed)).toBe(false);
      expect(isDomainAllowed('twitter.com', [])).toBe(false);
      expect(isDomainAllowed('twitter.com', null)).toBe(false);
    });
  });

  describe('isPrivateOrRestrictedIP (SSRF Protection)', () => {
    describe('IPv4 checks', () => {
      test('rejects loopback 127.0.0.0/8', () => {
        expect(isPrivateIPv4('127.0.0.1')).toBe(true);
        expect(isPrivateIPv4('127.1.2.3')).toBe(true);
        expect(isPrivateOrRestrictedIP('127.0.0.1')).toBe(true);
      });

      test('rejects private RFC1918 10.0.0.0/8', () => {
        expect(isPrivateIPv4('10.0.0.1')).toBe(true);
        expect(isPrivateIPv4('10.255.255.255')).toBe(true);
        expect(isPrivateOrRestrictedIP('10.10.10.10')).toBe(true);
      });

      test('rejects private RFC1918 172.16.0.0/12', () => {
        expect(isPrivateIPv4('172.16.0.1')).toBe(true);
        expect(isPrivateIPv4('172.31.255.255')).toBe(true);
        expect(isPrivateIPv4('172.20.1.1')).toBe(true);
        expect(isPrivateIPv4('172.32.0.1')).toBe(false); // Public
      });

      test('rejects private RFC1918 192.168.0.0/16', () => {
        expect(isPrivateIPv4('192.168.0.1')).toBe(true);
        expect(isPrivateIPv4('192.168.255.254')).toBe(true);
        expect(isPrivateOrRestrictedIP('192.168.1.100')).toBe(true);
      });

      test('rejects link-local and cloud metadata 169.254.0.0/16', () => {
        expect(isPrivateIPv4('169.254.169.254')).toBe(true);
        expect(isPrivateIPv4('169.254.1.1')).toBe(true);
        expect(isPrivateOrRestrictedIP('169.254.169.254')).toBe(true);
      });

      test('rejects current network 0.0.0.0/8', () => {
        expect(isPrivateIPv4('0.0.0.0')).toBe(true);
        expect(isPrivateIPv4('0.1.2.3')).toBe(true);
      });

      test('rejects CGNAT 100.64.0.0/10', () => {
        expect(isPrivateIPv4('100.64.0.1')).toBe(true);
        expect(isPrivateIPv4('100.127.255.255')).toBe(true);
        expect(isPrivateIPv4('100.128.0.1')).toBe(false); // Public
      });

      test('rejects documentation and reserved test-nets', () => {
        expect(isPrivateIPv4('192.0.2.1')).toBe(true); // TEST-NET-1
        expect(isPrivateIPv4('198.51.100.1')).toBe(true); // TEST-NET-2
        expect(isPrivateIPv4('203.0.113.1')).toBe(true); // TEST-NET-3
      });

      test('rejects multicast and broadcast 224.0.0.0/4 and 240.0.0.0/4', () => {
        expect(isPrivateIPv4('224.0.0.1')).toBe(true);
        expect(isPrivateIPv4('239.255.255.255')).toBe(true);
        expect(isPrivateIPv4('240.0.0.1')).toBe(true);
        expect(isPrivateIPv4('255.255.255.255')).toBe(true);
      });

      test('allows legitimate public IPv4 addresses', () => {
        expect(isPrivateIPv4('8.8.8.8')).toBe(false);
        expect(isPrivateIPv4('1.1.1.1')).toBe(false);
        expect(isPrivateIPv4('104.244.42.1')).toBe(false); // Twitter public IP
        expect(isPrivateOrRestrictedIP('93.184.216.34')).toBe(false);
      });
    });

    describe('IPv6 checks', () => {
      test('rejects loopback ::1', () => {
        expect(isPrivateIPv6('::1')).toBe(true);
        expect(isPrivateIPv6('0:0:0:0:0:0:0:1')).toBe(true);
        expect(isPrivateOrRestrictedIP('::1')).toBe(true);
      });

      test('rejects unspecified ::', () => {
        expect(isPrivateIPv6('::')).toBe(true);
        expect(isPrivateIPv6('0:0:0:0:0:0:0:0')).toBe(true);
      });

      test('rejects link-local fe80::/10', () => {
        expect(isPrivateIPv6('fe80::1')).toBe(true);
        expect(isPrivateIPv6('fe80::1ff:fe00:1')).toBe(true);
        expect(isPrivateIPv6('fea0::1234')).toBe(true);
      });

      test('rejects unique local fc00::/7', () => {
        expect(isPrivateIPv6('fc00::1')).toBe(true);
        expect(isPrivateIPv6('fd00:ec2::254')).toBe(true); // AWS metadata
        expect(isPrivateIPv6('fd12:3456:789a::1')).toBe(true);
      });

      test('rejects multicast ff00::/8', () => {
        expect(isPrivateIPv6('ff02::1')).toBe(true);
        expect(isPrivateIPv6('ff05::2')).toBe(true);
      });

      test('rejects IPv4-mapped IPv6 pointing to private addresses', () => {
        expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true);
        expect(isPrivateIPv6('::ffff:10.0.0.1')).toBe(true);
        expect(isPrivateIPv6('::ffff:192.168.1.1')).toBe(true);
        expect(isPrivateIPv6('::ffff:169.254.169.254')).toBe(true);
      });

      test('allows legitimate public IPv6 addresses', () => {
        expect(isPrivateIPv6('2607:f8b0:4005:805::200e')).toBe(false); // Google IPv6
        expect(isPrivateIPv6('2a00:1450:4009:81f::200e')).toBe(false);
        expect(isPrivateOrRestrictedIP('2600:1901:0:8da3::')).toBe(false);
      });
    });
  });

  describe('resolveAndValidateHostname', () => {
    test('resolves and accepts valid public DNS records', async () => {
      const mockDns = jest
        .fn()
        .mockResolvedValue([{ address: '104.244.42.1', family: 4 }]);
      const res = await resolveAndValidateHostname('twitter.com', mockDns);

      expect(res.error).toBeUndefined();
      expect(res.addresses).toEqual([{ address: '104.244.42.1', family: 4 }]);
    });

    test('rejects if ANY resolved address is private (multi-homed DNS SSRF)', async () => {
      const mockDns = jest.fn().mockResolvedValue([
        { address: '104.244.42.1', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);
      const res = await resolveAndValidateHostname('twitter.com', mockDns);

      expect(res.error).toMatch(
        /Access to private or restricted IP address is blocked/
      );
      expect(res.addresses).toEqual([]);
    });

    test('rejects when DNS resolution fails', async () => {
      const mockDns = jest
        .fn()
        .mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
      const res = await resolveAndValidateHostname(
        'nonexistent.twitter.com',
        mockDns
      );

      expect(res.error).toMatch(/DNS resolution failed/);
    });

    test('rejects raw IP literals resolving to private IPs directly', async () => {
      const res1 = await resolveAndValidateHostname('127.0.0.1');
      expect(res1.error).toMatch(/Access to private or restricted IP/);

      const res2 = await resolveAndValidateHostname('169.254.169.254');
      expect(res2.error).toMatch(/Access to private or restricted IP/);
    });
  });

  describe('fetchProofContent (Acceptance Criteria)', () => {
    describe('PASS tests', () => {
      test('allowed domain succeeds and returns expected content', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/success`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(true);
        expect(result.content).toBe(
          '<html><body>Proof content verified</body></html>'
        );
      });

      test('allowed subdomain (www.twitter.com) succeeds and returns content', async () => {
        const result = await fetchProofContent(
          `http://www.twitter.com:${serverPort}/success`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(true);
        expect(result.content).toBe(
          '<html><body>Proof content verified</body></html>'
        );
      });

      test('valid URL with empty body succeeds', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/empty`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(true);
        expect(result.content).toBe('');
      });
    });

    describe('FAIL tests: URL, Protocol and Domain Validation', () => {
      test('rejects non-allowlisted domain', async () => {
        const result = await fetchProofContent('http://evil.com/proof');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Domain not allowed: evil\.com/);
      });

      test('rejects attacker domain spoofing attempts', async () => {
        const result1 = await fetchProofContent(
          'http://evil-twitter.com/proof'
        );
        expect(result1.success).toBe(false);
        expect(result1.error).toMatch(/Domain not allowed/);

        const result2 = await fetchProofContent(
          'http://twitter.com.evil.com/proof'
        );
        expect(result2.success).toBe(false);
        expect(result2.error).toMatch(/Domain not allowed/);
      });

      test('rejects malformed URLs', async () => {
        expect((await fetchProofContent('')).success).toBe(false);
        expect((await fetchProofContent(null)).success).toBe(false);
        expect((await fetchProofContent(undefined)).success).toBe(false);
        expect((await fetchProofContent('not-a-valid-url')).success).toBe(
          false
        );
      });

      test('rejects unsupported protocols (ftp, file, javascript, gopher)', async () => {
        const resultFtp = await fetchProofContent('ftp://twitter.com/proof');
        expect(resultFtp.success).toBe(false);
        expect(resultFtp.error).toMatch(/Unsupported protocol: ftp:/);

        const resultFile = await fetchProofContent('file:///etc/passwd');
        expect(resultFile.success).toBe(false);
        expect(resultFile.error).toMatch(/Unsupported protocol: file:/);

        const resultJs = await fetchProofContent('javascript:alert(1)');
        expect(resultJs.success).toBe(false);
        expect(resultJs.error).toMatch(/Unsupported protocol: javascript:/);

        const resultGopher = await fetchProofContent('gopher://twitter.com/7');
        expect(resultGopher.success).toBe(false);
        expect(resultGopher.error).toMatch(/Unsupported protocol: gopher:/);
      });
    });

    describe('FAIL tests: SSRF & IP Protections', () => {
      test('rejects localhost', async () => {
        const result = await fetchProofContent('http://localhost/secret');
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Domain not allowed|Access to private/);
      });

      test('rejects 127.0.0.1', async () => {
        const result = await fetchProofContent('http://127.0.0.1/secret');
        expect(result.success).toBe(false);
      });

      test('rejects cloud metadata 169.254.169.254', async () => {
        const result = await fetchProofContent(
          'http://169.254.169.254/latest/meta-data/'
        );
        expect(result.success).toBe(false);
      });

      test('rejects private IPv4 addresses (10.x, 172.16.x, 192.168.x)', async () => {
        expect(
          (await fetchProofContent('http://10.0.0.1/secret')).success
        ).toBe(false);
        expect(
          (await fetchProofContent('http://172.16.0.1/secret')).success
        ).toBe(false);
        expect(
          (await fetchProofContent('http://192.168.1.1/secret')).success
        ).toBe(false);
      });

      test('rejects hostname resolving to private IP', async () => {
        const mockDns = jest
          .fn()
          .mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
        const result = await fetchProofContent('https://twitter.com/post/123', {
          dnsLookup: mockDns,
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(
          /Access to private or restricted IP address is blocked/
        );
      });

      test('rejects hostname resolving to metadata IP', async () => {
        const mockDns = jest
          .fn()
          .mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
        const result = await fetchProofContent('https://twitter.com/post/123', {
          dnsLookup: mockDns,
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(
          /Access to private or restricted IP address is blocked/
        );
      });

      test('rejects DNS resolution failure', async () => {
        const mockDns = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
        const result = await fetchProofContent('https://twitter.com/post/123', {
          dnsLookup: mockDns,
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/DNS resolution failed/);
      });
    });

    describe('FAIL tests: Redirect Security', () => {
      test('follows valid redirect on allowed domain and succeeds', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/redirect-allowed`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(true);
        expect(result.content).toBe(
          '<html><body>Proof content verified</body></html>'
        );
      });

      test('rejects redirect to non-allowlisted domain', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/redirect-evil`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Domain not allowed: evil\.com/);
      });

      test('rejects redirect to localhost', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/redirect-localhost`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: false, // Standard SSRF enforcement on redirect
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(
          /Domain not allowed|Access to private or restricted IP/
        );
      });

      test('rejects redirect to hostname resolving to private IP', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/redirect-private-dns`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: false,
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(
          /Access to private or restricted IP address is blocked/
        );
      });

      test('validates multiple redirect hops sequentially and succeeds', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/redirect-hop-1`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(true);
        expect(result.content).toBe(
          '<html><body>Proof content verified</body></html>'
        );
      });

      test('rejects redirect loop (A -> B -> A)', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/redirect-loop-a`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Redirect loop detected/);
      });

      test('rejects excessive redirect hops exceeding maxRedirects', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/redirect-excessive-1`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
            maxRedirects: 1,
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Too many redirects/);
      });
    });

    describe('FAIL tests: Timeout, Oversized Response, & HTTP Errors', () => {
      test('enforces response size limit via Content-Length header', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/oversized-header`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
            maxSize: 1024, // 1KB limit
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Response size limit exceeded/);
      });

      test('enforces response size limit during chunk streaming', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/oversized-stream`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
            maxSize: 1024, // 1KB limit
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Response size limit exceeded/);
      });

      test('enforces request timeout and aborts hanging requests', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/slow`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
            timeout: 50, // 50ms timeout
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Request timed out/);
      });

      test('handles HTTP 404 error responses', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/error-404`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/HTTP error 404/);
      });

      test('handles HTTP 500 server error responses', async () => {
        const result = await fetchProofContent(
          `http://twitter.com:${serverPort}/error-500`,
          {
            dnsLookup: localDnsMock(),
            _allowLocalhostForTesting: true,
          }
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/HTTP error 500/);
      });
    });
  });
});
