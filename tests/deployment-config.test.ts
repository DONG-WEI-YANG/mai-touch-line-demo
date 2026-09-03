import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import ignore from "ignore";
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

  it("keeps the GitHub Pages build on the supported Node 24 action runtime", () => {
    const workflow = readFileSync(
      resolve(root, ".github/workflows/deploy-pages.yml"),
      "utf8",
    );

    expect(workflow).toContain("node-version: 24");
    expect(workflow).toContain("actions/checkout@v7");
    expect(workflow).toContain("actions/setup-node@v7");
    expect(workflow).toContain("actions/upload-pages-artifact@v5");
    expect(workflow).toContain("actions/deploy-pages@v5");
  });

  it("keeps downloaded root models out of Vercel deployment inputs", () => {
    const deploymentIgnore = ignore().add(
      readFileSync(resolve(root, ".vercelignore"), "utf8"),
    );

    expect(
      deploymentIgnore.ignores(
        "models/pretrained/sentiment-bert/model.safetensors",
      ),
    ).toBe(true);
    expect(deploymentIgnore.ignores("assets/icon.png")).toBe(false);
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
