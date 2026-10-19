import type { DataMode } from "../shared/types.js";

export const ZOHO_DATA_CENTERS = ["com", "eu", "in", "com.au", "jp", "ca", "sa", "com.cn"] as const;
export type ZohoDataCenter = (typeof ZOHO_DATA_CENTERS)[number];

export interface ZohoCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  booksOrgId: string;
  dc: ZohoDataCenter;
}

export interface Config {
  mode: DataMode;
  port: number;
  production: boolean;
  cacheTtlSeconds: number;
  enableApiTester: boolean;
  /** Present only in live mode. */
  zoho: ZohoCredentials | null;
}

export class ConfigError extends Error {}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const mode = (env.DATA_MODE ?? "mock") as DataMode;
  if (mode !== "mock" && mode !== "live") {
    throw new ConfigError(`DATA_MODE must be "mock" or "live", got "${env.DATA_MODE}"`);
  }
  const production = env.NODE_ENV === "production";

  let zoho: ZohoCredentials | null = null;
  if (mode === "live") {
    const required = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN", "ZOHO_BOOKS_ORG_ID"] as const;
    const missing = required.filter((k) => !env[k]);
    if (missing.length) {
      throw new ConfigError(`DATA_MODE=live requires ${missing.join(", ")} (see .env.example)`);
    }
    const dc = (env.ZOHO_DC ?? "com") as ZohoDataCenter;
    if (!ZOHO_DATA_CENTERS.includes(dc)) {
      throw new ConfigError(`ZOHO_DC must be one of ${ZOHO_DATA_CENTERS.join(", ")}, got "${dc}"`);
    }
    zoho = {
      clientId: env.ZOHO_CLIENT_ID!,
      clientSecret: env.ZOHO_CLIENT_SECRET!,
      refreshToken: env.ZOHO_REFRESH_TOKEN!,
      booksOrgId: env.ZOHO_BOOKS_ORG_ID!,
      dc,
    };
  }

  return {
    mode,
    port: Number(env.PORT ?? 3001),
    production,
    cacheTtlSeconds: Number(env.CACHE_TTL_SECONDS ?? 300),
    enableApiTester: env.ENABLE_API_TESTER ? env.ENABLE_API_TESTER === "true" : !production,
    zoho,
  };
}

export const accountsUrl = (dc: ZohoDataCenter) => `https://accounts.zoho.${dc}`;
export const apiUrl = (dc: ZohoDataCenter) => `https://www.zohoapis.${dc}`;
