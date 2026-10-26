import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

export async function buildOffline(directory) {
  const files = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const target = resolve(path, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && target !== resolve(directory, "sw.js"))
        files.push(target);
    }
  }
  await visit(directory);
  files.sort();
  const template = await readFile(
    new URL("../src/offline/worker.js", import.meta.url),
    "utf8",
  );
  const hash = createHash("sha256").update(template);
  for (const file of files) {
    hash.update(relative(directory, file));
    hash.update(await readFile(file));
  }
  const version = hash.digest("hex").slice(0, 20);
  const assets = [
    "./",
    ...files.map(
      (file) => "./" + relative(directory, file).split("\\").join("/"),
    ),
  ];
  const worker = template
    .replace("__PRECACHE__.map", JSON.stringify(assets) + ".map")
    .replace("+ __BUILD_ID__;", "+ " + JSON.stringify(version) + ";");
  await writeFile(resolve(directory, "sw.js"), worker);
  return { version, assets };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await buildOffline(resolve("dist"));
  console.log(
    `Offline cache: ${result.assets.length} resources, version ${result.version}`,
  );
}
