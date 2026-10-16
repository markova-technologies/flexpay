const NodeCache = require('node-cache');
const { loadConfig } = require('../../config');

const tokenCache = new NodeCache({ stdTTL: 3300 }); // 55 minutes

class MpesaClient {
  constructor() {
    this.config = loadConfig();
    this.baseUrl = this.config.MPESA_BASE_URL || 'https://apisandbox.safaricom.et';
  }

  async getAccessToken() {
    const cached = tokenCache.get('mpesa_access_token');
    if (cached) return cached;

    const consumerKey = this.config.MPESA_CONSUMER_KEY;
    const consumerSecret = this.config.MPESA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      // Mock token for test environments without live credentials
      const mockToken = `mock_token_${Date.now()}`;
      tokenCache.set('mpesa_access_token', mockToken);
      return mockToken;
    }

    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    try {
      const response = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      if (!response.ok) {
        throw new Error(`M-PESA OAuth failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      const token = data.access_token;
      tokenCache.set('mpesa_access_token', token);
      return token;
    } catch (err) {
      if (this.config.NODE_ENV !== 'production') {
        const mockFallback = `mock_token_fallback_${Date.now()}`;
        tokenCache.set('mpesa_access_token', mockFallback);
        return mockFallback;
      }
      throw new Error(`Failed to acquire M-PESA OAuth token: ${err.message}`);
    }
  }

  async post(path, data) {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const responseBody = await response.json();
    return {
      status: response.status,
      data: responseBody,
    };
  }
}

module.exports = { MpesaClient };
