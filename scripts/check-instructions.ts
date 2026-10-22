// BACKEND_INSTRUCTIONS.md §12.4 — fails CI if a module folder, a MatchEventType value, an
// env.schema.ts key, or an errors.ts error code is not mentioned in the instructions file.
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');
const INSTRUCTIONS_PATH = join(ROOT, 'BACKEND_INSTRUCTIONS.md');

function readInstructions(): string {
  return readFileSync(INSTRUCTIONS_PATH, 'utf8');
}

function moduleFolders(): string[] {
  const modulesDir = join(ROOT, 'src', 'modules');
  return readdirSync(modulesDir).filter((entry) => statSync(join(modulesDir, entry)).isDirectory());
}

function matchEventTypeValues(): string[] {
  const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');
  const match = /enum MatchEventType \{([^}]+)\}/.exec(schema);
  const body = match?.[1];
  if (!body) throw new Error('MatchEventType enum not found in prisma/schema.prisma');
  return body
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function capturedGroup1(matches: IterableIterator<RegExpMatchArray>): string[] {
  const values: string[] = [];
  for (const m of matches) {
    const group = m[1];
    if (group) values.push(group);
  }
  return values;
}

function envSchemaKeys(): string[] {
  const source = readFileSync(join(ROOT, 'src', 'config', 'env.schema.ts'), 'utf8');
  const classBody = /class EnvironmentVariables \{([\s\S]+?)\n\}/.exec(source)?.[1];
  if (!classBody)
    throw new Error('EnvironmentVariables class not found in src/config/env.schema.ts');
  return capturedGroup1(classBody.matchAll(/^\s{2}([A-Z][A-Z0-9_]*)[?!]?\s*[:=]/gm));
}

function errorCodes(): string[] {
  const source = readFileSync(join(ROOT, 'src', 'common', 'errors.ts'), 'utf8');
  return capturedGroup1(source.matchAll(/'([A-Z][A-Z0-9_]*)'/g));
}

function checkAllMentioned(label: string, values: string[], instructions: string): string[] {
  return values
    .filter((value) => !instructions.includes(value))
    .map((value) => `${label}: ${value}`);
}

function main(): void {
  const instructions = readInstructions();

  const missing = [
    ...checkAllMentioned('src/modules/* folder', moduleFolders(), instructions),
    ...checkAllMentioned('MatchEventType value', matchEventTypeValues(), instructions),
    ...checkAllMentioned('env.schema.ts key', envSchemaKeys(), instructions),
    ...checkAllMentioned('errors.ts error code', errorCodes(), instructions),
  ];

  if (missing.length > 0) {
    console.error('BACKEND_INSTRUCTIONS.md is out of date. Missing:\n');
    for (const line of missing) console.error(`  - ${line}`);
    console.error('\nUpdate BACKEND_INSTRUCTIONS.md in the same change (see §0).');
    process.exit(1);
  }

  console.log('BACKEND_INSTRUCTIONS.md is up to date.');
}

main();
