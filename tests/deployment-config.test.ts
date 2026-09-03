import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

describe("web assets and deployment configuration", () => {
  it("ships valid PNG files for every configured Expo icon", async () => {
    const app = JSON.parse(readFileSync(resolve(root, "app.json"), "utf8"));
    const configured = [
      app.expo.icon,
      app.expo.web.favicon,
      app.expo.android.adaptiveIcon.foregroundImage,
    ];

    expect(configured.every((entry) => typeof entry === "string")).toBe(true);
    for (const relativePath of configured) {
      const path = resolve(root, relativePath);
      expect(existsSync(path), `${relativePath} should exist`).toBe(true);
      const metadata = await sharp(path).metadata();
      expect(metadata.format).toBe("png");
      expect(metadata.width).toBeGreaterThanOrEqual(64);
      expect(metadata.width).toBe(metadata.height);
    }
  });

  it("uses one typed Vercel config and the repository build script", () => {
    expect(existsSync(resolve(root, "vercel.ts"))).toBe(true);
    expect(existsSync(resolve(root, "vercel.json"))).toBe(false);

    const source = readFileSync(resolve(root, "vercel.ts"), "utf8");
    expect(source).toContain("@vercel/config/v1");
    expect(source).toContain("export const config");
    expect(source).toContain("buildCommand: 'npm run web:build'");
    expect(source).toContain("outputDirectory: 'dist'");
  });

  it("pins the Vercel Node 24 runtime contract", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(packageJson.engines.node).toBe(">=24 <25");
    expect(packageJson.scripts["web:build"]).toBe("expo export -p web --output-dir dist");
  });

  it("does not exclude executable NLP model source from deployments", () => {
    const ignoreLines = readFileSync(resolve(root, ".gitignore"), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim());
    expect(ignoreLines).not.toContain("nlp-service/models/");
    expect(existsSync(resolve(root, "nlp-service/models/tiny_nlp.py"))).toBe(true);
    expect(existsSync(resolve(root, "nlp-service/models/model_registry.py"))).toBe(true);
  });
});
