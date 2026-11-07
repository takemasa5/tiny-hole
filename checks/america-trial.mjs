// Keep the America-only entry point for the shared stage regression.
process.argv.push("--stage=america");
await import("./stage-expansion.mjs");
