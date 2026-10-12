let cachedToken: { token: string; exp: number } | null = null;

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export async function accessToken() {
  const clientId = envValue("GOOGLE_CLIENT_ID");
  const clientSecret = envValue("GOOGLE_CLIENT_SECRET");
  const refreshToken = envValue("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.token;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google no renovó el acceso. Volvé a conectar Drive. ${detail.slice(0, 180)}`,
    );
  }
  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };
  cachedToken = {
    token: data.access_token,
    exp: now + (data.expires_in ?? 3600),
  };
  return data.access_token;
}
