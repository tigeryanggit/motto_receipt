import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tokenPath = path.join(root, ".google-drive-token.json");
const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://127.0.0.1:38465/oauth2callback";
const redirect = new URL(redirectUri);

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", clientId);
authUrl.searchParams.set("redirect_uri", redirectUri);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/drive");
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", redirectUri);
    if (url.pathname !== redirect.pathname) {
      response.writeHead(404);
      response.end();
      return;
    }
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    if (error || !code) {
      response.writeHead(400);
      response.end(error || "Missing code");
      server.close();
      process.exit(1);
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.refresh_token) {
      response.writeHead(500);
      response.end("Google did not return a refresh token. Approve consent again.");
      server.close();
      process.exit(1);
    }

    writeFileSync(
      tokenPath,
      JSON.stringify({ refresh_token: tokens.refresh_token, scope: tokens.scope ?? "" }, null, 2)
    );
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end("<p>Google Drive authorized. You can close this tab.</p>");
    console.log("Saved Google Drive refresh token.");
    server.close();
  } catch (error) {
    response.writeHead(500);
    response.end("Authorization failed");
    console.error(error instanceof Error ? error.message : error);
    server.close();
    process.exit(1);
  }
});

server.listen(Number(redirect.port), "127.0.0.1", () => {
  console.log("Open this URL and sign in with the Google account that can open the receipts folder:");
  console.log(authUrl.toString());
});
