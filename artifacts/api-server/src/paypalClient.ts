const PAYPAL_LIVE = "https://api-m.paypal.com";
const PAYPAL_SANDBOX = "https://api-m.sandbox.paypal.com";

let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedBaseUrl: string | null = null;

export interface PayPalCredentials {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

async function detectBaseUrl(clientId: string, clientSecret: string): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const tryAuth = async (base: string): Promise<boolean> => {
    const r = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    return r.ok;
  };
  if (await tryAuth(PAYPAL_LIVE)) {
    cachedBaseUrl = PAYPAL_LIVE;
  } else if (await tryAuth(PAYPAL_SANDBOX)) {
    cachedBaseUrl = PAYPAL_SANDBOX;
  } else {
    throw new Error("Credenciais PayPal inválidas (não autenticaram em live nem sandbox)");
  }
  return cachedBaseUrl;
}

export async function getPayPalCredentials(): Promise<PayPalCredentials> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID e PAYPAL_CLIENT_SECRET são obrigatórios");
  }
  const baseUrl = await detectBaseUrl(clientId, clientSecret);
  return { clientId, clientSecret, baseUrl };
}

export async function getPayPalAccessToken(): Promise<{ token: string; baseUrl: string }> {
  const { clientId, clientSecret, baseUrl } = await getPayPalCredentials();
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return { token: cachedToken.token, baseUrl };
  }
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PayPal auth failed (${resp.status}): ${text}`);
  }
  const data = (await resp.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return { token: data.access_token, baseUrl };
}

export async function paypalFetch<T>(
  path: string,
  init: { method: string; body?: unknown; headers?: Record<string, string> } = { method: "GET" },
): Promise<T> {
  const { token, baseUrl } = await getPayPalAccessToken();
  const resp = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...init.headers,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PayPal ${init.method} ${path} failed (${resp.status}): ${text}`);
  }
  if (resp.status === 204) return {} as T;
  return (await resp.json()) as T;
}
