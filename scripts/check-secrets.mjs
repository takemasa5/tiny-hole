import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const mode = process.argv[2];
if (mode !== "staged" && mode !== "history") {
  console.error("Usage: node scripts/check-secrets.mjs staged|history");
  process.exit(1);
}

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    console.error("Gitの検査対象を取得できませんでした。検査を中止します。");
    process.exit(1);
  }
  return result.stdout;
}

process.chdir(git(["rev-parse", "--show-toplevel"]).trim());
if (mode === "history" && !git(["rev-list", "--all", "--max-count=1"]).trim()) {
  console.log("コミット履歴がないため、履歴の検査対象はありません。");
  process.exit(0);
}

// Reject forbidden paths by name before the scanner can read their contents.
const paths = git(
  mode === "staged"
    ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
    : ["log", "--all", "--format=", "--name-only", "-z"],
);
if (
  paths
    .split("\0")
    .some((path) => /(^|\/)(?:\.env[^/]*|DO_NOT_READ)(?:\/|$)/.test(path))
) {
  console.error(
    ".env* または DO_NOT_READ を含むため、コミット・pushを中止します。",
  );
  process.exit(1);
}

const command =
  spawnSync("gitleaks", ["version"], { stdio: "ignore" }).status === 0
    ? "gitleaks"
    : ["/opt/homebrew/bin/gitleaks", "/usr/local/bin/gitleaks"].find((path) =>
        existsSync(path),
      );
if (!command) {
  console.error(
    "gitleaksが見つかりません。brew install gitleaks を実行してください。検査は省略しません。",
  );
  process.exit(1);
}

const result = spawnSync(
  command,
  [
    "git",
    "--config",
    ".gitleaks.toml",
    "--redact=100",
    "--no-banner",
    "--no-color",
    "--ignore-gitleaks-allow",
    ...(mode === "staged"
      ? ["--pre-commit", "--staged"]
      : ["--log-opts=--all"]),
  ],
  { stdio: "inherit" },
);
if (result.error || result.status !== 0) {
  console.error(
    "検出事項または検査エラーがあります。コミット・pushを中止します。",
  );
  process.exit(1);
}
