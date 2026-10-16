import { chmodSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function git(args, allowMissing = false) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (
    result.error ||
    (result.status !== 0 && !(allowMissing && result.status === 1))
  ) {
    throw new Error("Gitフックの設定を確認・更新できませんでした。");
  }
  return result.stdout.trim();
}

process.chdir(git(["rev-parse", "--show-toplevel"]));
const hooksPath = git(["config", "--get", "core.hooksPath"], true);
if (hooksPath && hooksPath !== ".githooks") {
  throw new Error(
    "別のcore.hooksPathが設定されています。既存設定を上書きせず停止しました。",
  );
}
for (const hook of ["pre-commit", "pre-push"]) {
  if (
    !hooksPath &&
    existsSync(git(["rev-parse", "--git-path", `hooks/${hook}`]))
  ) {
    throw new Error("既存のGitフックがあります。上書きせず停止しました。");
  }
  chmodSync(`.githooks/${hook}`, 0o755);
}
git(["config", "--local", "core.hooksPath", ".githooks"]);
console.log(
  "このリポジトリのコミット前・push前のgitleaks検査を有効にしました。",
);
