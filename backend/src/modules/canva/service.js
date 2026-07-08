const repo = require('../certificates/repository');

const CANVA_API_BASE = 'https://api.canva.com/rest/v1';
const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize';
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token';

function getCanvaConfig() {
  return {
    clientId: process.env.CANVA_CLIENT_ID,
    clientSecret: process.env.CANVA_CLIENT_SECRET,
    redirectUri:
      process.env.CANVA_REDIRECT_URI ||
      `${process.env.APP_URL || 'http://localhost:5173'}/admin/canva-templates/callback`,
  };
}

function getAuthUrl(state) {
  const config = getCanvaConfig();
  if (!config.clientId) return null;

  // Generate random state for CSRF protection if not provided
  const crypto = require('crypto');
  const stateParam = state || crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope:
      'design:content:read design:content:write design:meta:read brand:read',
    state: stateParam,
  });

  return `${CANVA_AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForToken(code) {
  const config = getCanvaConfig();

  const response = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      error.error_description || 'Failed to exchange code for token'
    );
  }

  return response.json();
}

async function refreshAccessToken(refreshToken) {
  const config = getCanvaConfig();

  const response = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Canva token');
  }

  return response.json();
}

async function getValidToken() {
  const settings = await repo.getCanvaSettings();
  if (!settings) return null;

  // Check if token is expired (with 5 min buffer)
  if (
    settings.token_expires_at &&
    new Date(settings.token_expires_at) > new Date(Date.now() + 300000)
  ) {
    return settings.access_token;
  }

  // Try to refresh
  if (settings.refresh_token) {
    try {
      const tokens = await refreshAccessToken(settings.refresh_token);
      await repo.saveCanvaSettings(
        {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || settings.refresh_token,
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ).toISOString(),
          organization_id: settings.organization_id,
        },
        settings.created_by
      );
      return tokens.access_token;
    } catch {
      return null;
    }
  }

  return null;
}

async function listDesigns() {
  const token = await getValidToken();
  if (!token) throw new Error('Canva not connected. Please authorize first.');

  const response = await fetch(`${CANVA_API_BASE}/designs`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to list Canva designs');
  }

  return response.json();
}

async function getDesign(designId) {
  const token = await getValidToken();
  if (!token) throw new Error('Canva not connected.');

  const response = await fetch(`${CANVA_API_BASE}/designs/${designId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to get Canva design');
  }

  return response.json();
}

async function importDesignAsTemplate(designId, userId) {
  const design = await getDesign(designId);

  const template = await repo.createTemplate(
    {
      name: design.title || `Imported from Canva - ${designId}`,
      description: `Imported from Canva design: ${designId}`,
      template_data: {
        canva_design_id: designId,
        canva_pages: design.pages || [],
        background: '#FFFFFF',
        accent: '#000000',
      },
      canva_design_id: designId,
    },
    userId
  );

  return template;
}

async function exportCertificateToCanva(certificateId) {
  const token = await getValidToken();
  if (!token) throw new Error('Canva not connected.');

  const cert = await repo.getCertificateById(certificateId);
  if (!cert) throw new Error('Certificate not found');

  // Create a new Canva design based on certificate data
  const response = await fetch(`${CANVA_API_BASE}/designs`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: cert.title,
      design_type: {
        type: 'custom',
        width: 842,
        height: 595,
      },
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create Canva design');
  }

  return response.json();
}

async function listBrands() {
  const token = await getValidToken();
  if (!token) throw new Error('Canva not connected.');

  const response = await fetch(`${CANVA_API_BASE}/brands`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to list Canva brands');
  }

  return response.json();
}

async function getConnectionStatus() {
  const settings = await repo.getCanvaSettings();
  if (!settings) return { connected: false };

  const token = await getValidToken();
  return {
    connected: !!token,
    organization_id: settings.organization_id,
    token_expires_at: settings.token_expires_at,
  };
}

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  listDesigns,
  getDesign,
  importDesignAsTemplate,
  exportCertificateToCanva,
  listBrands,
  getConnectionStatus,
};
