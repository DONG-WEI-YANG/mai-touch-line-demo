import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");

function readRunBlock(): string {
  const workflow = readFileSync(
    resolve(root, ".github/workflows/keepalive.yml"),
    "utf8",
  ).replace(/\r\n/g, "\n");
  const marker = "        run: |\n";
  const start = workflow.indexOf(marker);

  expect(start).toBeGreaterThanOrEqual(0);
  return workflow
    .slice(start + marker.length)
    .split("\n")
    .map((line) => line.replace(/^ {10}/, ""))
    .join("\n");
}

describe("Render keepalive workflow", () => {
  it("retries after a curl timeout and succeeds on the next healthy response", () => {
    const workflowScript = readRunBlock();
    const harness = `
curl() {
  output_file=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      -o|--output)
        output_file="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  if [ "\${i:-0}" -eq 1 ]; then
    printf '000'
    return 28
  fi

  printf '{"ok":true}' > "$output_file"
  printf '200'
}

sleep() { :; }

${workflowScript}
`;
    const bash =
      process.platform === "win32"
        ? "C:/Program Files/Git/usr/bin/bash.exe"
        : "bash";
    const result = spawnSync(bash, ["-e", "-c", harness], {
      encoding: "utf8",
      timeout: 5_000,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("attempt 1 -> HTTP 000");
    expect(result.stdout).toContain("attempt 2 -> HTTP 200");
  });
});
