import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(projectRoot, "www");
const filesToCopy = ["index.html", "manifest.webmanifest", "sw.js"];
const directoriesToCopy = ["app", "assets"];

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of filesToCopy) {
  await cp(resolve(projectRoot, file), resolve(outputDirectory, file));
}

for (const directory of directoriesToCopy) {
  await cp(resolve(projectRoot, directory), resolve(outputDirectory, directory), {
    recursive: true
  });
}

console.log("Arquivos do Agenda Gama preparados para o aplicativo Android.");
