import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const source = resolve(".");
const fixture = mkdtempSync(join(tmpdir(), "hole-secrets-check-"));
function run(command, args, expected = 0, input) {
  const result = spawnSync(command, args, {
    cwd: fixture,
    encoding: "utf8",
    input,
  });
  assert.equal(
    result.status,
    expected,
    result.error?.message || result.stderr || result.stdout,
  );
  return result.stdout;
}
const git = (...args) => run("git", args);
const commitIdentity = [
  "-c",
  "user.name=Security check",
  "-c",
  "user.email=check@example.invalid",
];
try {
  git("init", "--quiet");
  for (const path of ["scripts", ".githooks"]) {
    mkdirSync(join(fixture, path));
    cpSync(join(source, path), join(fixture, path), { recursive: true });
  }
  cpSync(join(source, ".gitleaks.toml"), join(fixture, ".gitleaks.toml"));
  run(process.execPath, ["scripts/install-git-hooks.mjs"]);
  writeFileSync(
    join(fixture, "safe.txt"),
    [
      "Safe text",
      ["contact", "example.com"].join("@"),
      ["123+sample", "users.noreply.github.com"].join("@"),
    ].join("\n") + "\n",
  );
  git("add", ".");
  run("git", [...commitIdentity, "commit", "--quiet", "-m", "Safe fixture"]);

  const cases = [
    [
      "private key fixture",
      [
        ["-----BEGIN", "PRIVATE KEY-----"].join(" "),
        "NOT_A_REAL_KEY".repeat(8),
        ["-----END", "PRIVATE KEY-----"].join(" "),
      ].join("\n"),
    ],
    ["email address", ["security-check", "invalid.test"].join("@")],
    ["local home path", ["/Users", "sample-person", "project"].join("/")],
    ["phone number", ["電話: 090", "1234", "5678"].join("-")],
  ];
  for (const [label, content] of cases) {
    writeFileSync(join(fixture, "candidate.txt"), content + "\n");
    git("add", "candidate.txt");
    run(
      "git",
      [...commitIdentity, "commit", "--quiet", "-m", "Must be rejected"],
      1,
    );
    assert.equal(
      git("rev-list", "--count", "HEAD").trim(),
      "1",
      `${label}: commit was created`,
    );
    git("reset", "--quiet", "--", "candidate.txt");
  }

  // Index-only fixtures prove the path guard without creating or reading forbidden files.
  const blob = git("hash-object", "safe.txt").trim();
  for (const path of [".env.local", "DO_NOT_READ/fixture.txt"]) {
    git("update-index", "--add", "--cacheinfo", `100644,${blob},${path}`);
    run(
      "git",
      [...commitIdentity, "commit", "--quiet", "-m", "Forbidden path"],
      1,
    );
    git("update-index", "--force-remove", path);
  }
  run("sh", [".githooks/pre-push"]);

  // Only this isolated fixture bypasses its hook to test rejection of a historical secret.
  writeFileSync(join(fixture, "candidate.txt"), cases[0][1] + "\n");
  git("add", "candidate.txt");
  run("git", [
    ...commitIdentity,
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "--quiet",
    "-m",
    "Historical fixture",
  ]);
  git("rm", "--quiet", "candidate.txt");
  run("git", [...commitIdentity, "commit", "--quiet", "-m", "Remove fixture"]);
  run("sh", [".githooks/pre-push"], 1);
  console.log(
    "秘密情報・メール・ローカルパス・電話・禁止パスをコミット前に拒否し、履歴の秘密情報をpush前に拒否することを確認しました。",
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
