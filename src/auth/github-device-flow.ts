import { CliError } from "../cli/ui.js";

/**
 * GitHub OAuth Device Flow — `gh auth login` 과 같은 방식.
 *
 * CLI 는 브라우저 리다이렉트를 받을 수 없으니(로컬호스트 서버를 새로 띄우는 대안보다),
 * 사람이 코드를 보고 브라우저에서 직접 입력하게 하고 CLI 는 폴링만 한다.
 */

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const USER_URL = "https://api.github.com/user";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  interval?: number;
}

export interface DeviceFlowResult {
  githubLogin: string;
  token: string;
}

export interface DeviceFlowCallbacks {
  onCode(info: { userCode: string; verificationUri: string }): void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId }),
  });
  if (!res.ok) {
    throw new CliError(`GitHub device code 요청에 실패했습니다: ${res.status}`, { exitCode: 69 });
  }
  return (await res.json()) as DeviceCodeResponse;
}

/** 승인 대기 중 폴링. `expires_in` 을 넘기면 포기하고, `slow_down` 이 오면 간격을 늘린다. */
async function pollForToken(
  clientId: string,
  device: DeviceCodeResponse,
): Promise<string> {
  const deadline = Date.now() + device.expires_in * 1000;
  let interval = device.interval;

  while (Date.now() < deadline) {
    await sleep(interval * 1000);

    const res = await fetch(ACCESS_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code: device.device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const data = (await res.json()) as AccessTokenResponse;

    if (data.access_token) return data.access_token;
    if (data.error === "authorization_pending") continue;
    if (data.error === "slow_down") {
      interval = data.interval ?? interval + 5;
      continue;
    }
    if (data.error === "expired_token") {
      throw new CliError("로그인 코드가 만료됐습니다.", { exitCode: 69, hint: "`ie login` 을 다시 실행하세요." });
    }
    if (data.error) {
      throw new CliError(`GitHub 인증에 실패했습니다: ${data.error}`, { exitCode: 69 });
    }
  }

  throw new CliError("로그인 승인 대기 시간이 초과됐습니다.", { exitCode: 69 });
}

async function fetchGithubLogin(token: string): Promise<string> {
  const res = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) {
    throw new CliError(`GitHub 사용자 정보를 가져오지 못했습니다: ${res.status}`, { exitCode: 69 });
  }
  const data = (await res.json()) as { login?: string };
  if (!data.login) {
    throw new CliError("GitHub 응답에 login 이 없습니다.", { exitCode: 70 });
  }
  return data.login;
}

export async function runDeviceFlow(
  clientId: string,
  callbacks: DeviceFlowCallbacks,
): Promise<DeviceFlowResult> {
  const device = await requestDeviceCode(clientId);
  callbacks.onCode({ userCode: device.user_code, verificationUri: device.verification_uri });
  const token = await pollForToken(clientId, device);
  const githubLogin = await fetchGithubLogin(token);
  return { githubLogin, token };
}
