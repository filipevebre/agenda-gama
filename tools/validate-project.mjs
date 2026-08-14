import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { Script } from "node:vm";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([
  ".git",
  ".vercel",
  "arquivo-gama",
  "arquivo-gama-hosted",
  "chaveamento-campeonato",
  "fluent-minds-independent",
  "node_modules",
  "output"
]);

function walk(directory, predicate) {
  const results = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(fullPath, predicate));
    if (entry.isFile() && predicate(fullPath)) results.push(fullPath);
  }
  return results;
}

const errors = [];
const javascriptFiles = walk(join(root, "assets", "js"), (file) => extname(file) === ".js");
for (const file of javascriptFiles) {
  try {
    new Script(readFileSync(file, "utf8"), { filename: relative(root, file) });
  } catch (error) {
    errors.push(`${relative(root, file)}: ${error.message}`);
  }
}

const htmlFiles = [
  join(root, "index.html"),
  ...walk(join(root, "app"), (file) => extname(file) === ".html")
];
for (const file of htmlFiles) {
  const source = readFileSync(file, "utf8");
  const ids = [...source.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) {
    errors.push(`${relative(root, file)}: IDs duplicados: ${[...new Set(duplicateIds)].join(", ")}`);
  }

  for (const match of source.matchAll(/\s(?:src|href)=["']([^"'#?]+)["']/g)) {
    const reference = match[1];
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(reference)) continue;
    const target = reference.startsWith("/")
      ? join(root, reference.slice(1))
      : resolve(file, "..", reference);
    if (!existsSync(target)) errors.push(`${relative(root, file)}: arquivo ausente ${reference}`);
  }
}

const protectedSources = [
  join(root, "index.html"),
  join(root, "assets", "js", "auth.js")
].map((file) => readFileSync(file, "utf8")).join("\n");
if (/admin@gama\.edu\.br|password:\s*["']123456/i.test(protectedSources)) {
  errors.push("Credenciais demonstrativas nao podem ser publicadas no aplicativo.");
}

const securityMigration = join(root, "supabase", "migrations", "20260814_022_security_hardening.sql");
if (!existsSync(securityMigration)) {
  errors.push("A migracao de seguranca obrigatoria nao foi encontrada.");
} else {
  const securitySql = readFileSync(securityMigration, "utf8");
  if (!securitySql.includes('drop policy if exists "authenticated_use_communication_messages"')) {
    errors.push("A migracao nao remove a politica aberta de mensagens.");
  }
  if (/using\s*\(true\)|with check\s*\(true\)/i.test(securitySql)) {
    errors.push("A migracao de seguranca contem uma politica sem restricao.");
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validacao concluida: ${javascriptFiles.length} arquivos JavaScript e ${htmlFiles.length} paginas HTML.`);
