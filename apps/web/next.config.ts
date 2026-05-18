import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

function readRootEnv() {
  try {
    return readFileSync(resolve(__dirname, "../../.env"), "utf8");
  } catch {
    return "";
  }
}

function readRootEnvValue(key: string) {
  const line = readRootEnv()
    .split(/\r?\n/)
    .find((item) => item.trim().startsWith(`${key}=`));

  return line?.slice(key.length + 1).trim();
}

function buildAllowedDevOrigins() {
  const rawOrigins = [
    readRootEnvValue("FRONTEND_BASE_URL"),
    ...(readRootEnvValue("CORS_ORIGIN")?.split(",") ?? []),
  ].filter(Boolean) as string[];
  const hostnames = rawOrigins
    .map((origin) => {
      try {
        return new URL(origin.trim()).hostname;
      } catch {
        return null;
      }
    })
    .filter((hostname): hostname is string => Boolean(hostname) && hostname !== "localhost");

  return Array.from(new Set(hostnames));
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  allowedDevOrigins: buildAllowedDevOrigins(),
  env: {
    NEXT_PUBLIC_AMAP_KEY:
      process.env.NEXT_PUBLIC_AMAP_KEY ?? readRootEnvValue("NEXT_PUBLIC_AMAP_KEY") ?? "",
    NEXT_PUBLIC_AMAP_SECURITY_JS_CODE:
      process.env.NEXT_PUBLIC_AMAP_SECURITY_JS_CODE ??
      readRootEnvValue("NEXT_PUBLIC_AMAP_SECURITY_JS_CODE") ??
      "",
  },
};

export default nextConfig;
