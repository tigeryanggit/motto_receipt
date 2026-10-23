import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { referenceFileName } from "@/lib/receipt-ref";

const FOLDER_ID =
  process.env.GOOGLE_DRIVE_FOLDER_ID || "1mFGDSukAojMyuQ-pyHmvbI2Nkxpxruz9";

export class ReceiptSaveError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;
let lockTail: Promise<void> = Promise.resolve();

function refreshToken(): string | undefined {
  if (process.env.GOOGLE_REFRESH_TOKEN) {
    return process.env.GOOGLE_REFRESH_TOKEN;
  }

  const tokenPath = path.join(process.cwd(), ".google-drive-token.json");
  if (!existsSync(tokenPath)) {
    return undefined;
  }

  const parsed = JSON.parse(readFileSync(tokenPath, "utf8")) as {
    refresh_token?: string;
  };
  return parsed.refresh_token;
}

export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      refreshToken()
  );
}

function assertConfigured(): void {
  if (!driveConfigured()) {
    throw new ReceiptSaveError(
      "Google Drive 尚未授權。請先在這台電腦執行 npm run authorize-drive。",
      503
    );
  }
  if (!/^[\w-]+$/.test(FOLDER_ID)) {
    throw new ReceiptSaveError("Google Drive 資料夾設定不正確。", 500);
  }
}

async function accessToken(): Promise<string> {
  assertConfigured();
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    refresh_token: refreshToken() ?? "",
    grant_type: "refresh_token",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    tokenCache = null;
    console.error("Google token refresh failed", response.status);
    throw new ReceiptSaveError(
      "Google Drive 授權失效。請重新執行 npm run authorize-drive。",
      401
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!payload.access_token) {
    throw new ReceiptSaveError("Google Drive 授權沒有傳回存取權杖。", 401);
  }

  tokenCache = {
    token: payload.access_token,
    expiresAt: Date.now() + Math.max(30, (payload.expires_in ?? 3600) - 60) * 1000,
  };
  return payload.access_token;
}

async function googleError(response: Response): Promise<ReceiptSaveError> {
  const text = await response.text();
  console.error("Google Drive request failed", response.status, text.slice(0, 500));
  if (response.status === 401 || response.status === 403) {
    return new ReceiptSaveError(
      "Google Drive 授權失效或沒有權限。請重新授權，並確認該帳戶可以開啟指定資料夾。",
      response.status
    );
  }
  if (response.status === 404) {
    return new ReceiptSaveError(
      "找不到指定的 Google Drive 資料夾。請確認授權帳戶可以存取該資料夾。",
      404
    );
  }
  return new ReceiptSaveError("儲存到 Google Drive 失敗，請稍後再試。", 502);
}

export async function listMonthFileNames(monthKey: string): Promise<string[]> {
  const token = await accessToken();
  const names: string[] = [];
  let pageToken = "";

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set(
      "q",
      `'${FOLDER_ID}' in parents and trashed = false and name contains '${monthKey}-'`
    );
    url.searchParams.set("fields", "nextPageToken, files(name)");
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw await googleError(response);
    }

    const payload = (await response.json()) as {
      nextPageToken?: string;
      files?: Array<{ name?: string }>;
    };
    for (const file of payload.files ?? []) {
      if (file.name) {
        names.push(file.name);
      }
    }
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken);

  return names;
}

export async function uploadReceiptPhoto(input: {
  reference: string;
  jpeg: Buffer;
  userName: string;
  receiptDate: string;
  category: string;
  amount: string;
}): Promise<{ reference: string; fileName: string; webViewLink: string }> {
  const token = await accessToken();
  const reference = input.reference;
  const fileName = referenceFileName(reference);
  const boundary = `receipt-${Date.now()}`;
  const metadata = {
    name: fileName,
    parents: [FOLDER_ID],
    description: [
      `姓名: ${input.userName}`,
      `收據日期: ${input.receiptDate}`,
      `類別: ${input.category}`,
      `金額: ${input.amount}`,
      `參考編號: ${reference}`,
    ].join("\n"),
  };
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    ),
    Buffer.from(`--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`),
    input.jpeg,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: new Uint8Array(body),
    }
  );

  if (!response.ok) {
    throw await googleError(response);
  }

  const payload = (await response.json()) as { webViewLink?: string };
  return {
    reference,
    fileName,
    webViewLink: payload.webViewLink ?? "",
  };
}

export function withDriveLock<T>(task: () => Promise<T>): Promise<T> {
  const run = lockTail.then(task, task);
  lockTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
