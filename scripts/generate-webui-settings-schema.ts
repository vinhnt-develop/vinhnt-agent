/**
 * P2.1 — generate the webui kernel-settings zod schema from the agent HTTP
 * contract, so the webui can no longer drift from the API:
 *
 *   constraints → UpdateKernelSettingsDto (class-validator metadata)
 *   defaults    → AgentSettingsService.DEFAULT_SETTINGS
 *   field order → DTO declaration order (section comments preserved)
 *
 * Run from the vinhnt-agent repo root:
 *   pnpm gen:webui-schema
 *
 * Options:
 *   --out <path>  Output file. Default: sibling checkout
 *                 ../vinhnt-webui/src/features/settings/schemas/agent-settings.schema.generated.ts
 *
 * Known webui-side overrides (intentional, NOT drift):
 *   - compactionThreshold: DTO accepts legacy percent 0-100 for stored files /
 *     old clients (P6.6), but the webui must only emit the canonical ratio
 *     0.05-1.
 *   - @IsObject fields: class-validator pins the container type only; deep
 *     zod shapes live in OBJECT_SHAPES below and the service guards them
 *     again at load time.
 */
import 'reflect-metadata';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { getMetadataStorage } from 'class-validator';
import { UpdateKernelSettingsDto } from '@/modules/agent/dto/update-kernel-settings.dto';
import { DEFAULT_SETTINGS } from '@/modules/agent/services/agent-settings.service';

/** Structural view of class-validator ValidationMetadata (not root-exported in 0.15).
 *  In 0.15 the discriminator (isNumber/min/max/isIn/...) lives in `name`,
 *  while `type` is only the generic customValidation/conditionalValidation. */
interface ValidationMeta {
  readonly name?: string;
  readonly constraints: unknown[];
}

/** Webui-only constraint overrides keyed by DTO field name. */
const OVERRIDES: Record<string, string> = {
  compactionThreshold: 'z.number().min(0.05).max(1)',
};

/** Deep zod shapes for @IsObject fields (container type comes from the DTO). */
const OBJECT_SHAPES: Record<string, string> = {
  globalPermissionRules:
    'z.record(z.string(), z.union([z.string(), z.record(z.string(), z.string())]))',
  permissionRiskDefaults: 'z.record(z.string(), z.string())',
};

interface FieldSource {
  name: string;
  section: string | null;
  doc: string[];
}

function parseDtoSource(): FieldSource[] {
  const src = readFileSync(
    path.resolve(__dirname, '../src/modules/agent/dto/update-kernel-settings.dto.ts'),
    'utf8',
  );
  const fields: FieldSource[] = [];
  let section: string | null = null;
  let doc: string[] = [];
  let inDoc = false;

  for (const raw of src.split(/\r?\n/)) {
    if (inDoc) {
      const end = raw.match(/^\s*\*\//);
      if (end) {
        inDoc = false;
        continue;
      }
      const text = raw.replace(/^\s*\*\s?/, '').trimEnd();
      if (text) doc.push(text);
      continue;
    }
    if (/^\s*\/\*\*/.test(raw)) {
      if (/\*\/\s*$/.test(raw)) {
        // single-line doc: /** text */
        const text = raw
          .replace(/^\s*\/\*\*\s?/, '')
          .replace(/\s*\*\/\s*$/, '')
          .trimEnd();
        doc = text ? [text] : [];
        continue;
      }
      inDoc = true;
      doc = [];
      continue;
    }
    const sec = raw.match(/^\s*\/\/\s*──\s*(.+?)\s*─*\s*$/);
    if (sec) {
      section = sec[1];
      continue;
    }
    const prop = raw.match(/^  (\w+)\?:/);
    if (prop) {
      fields.push({ name: prop[1], section, doc });
      doc = [];
      continue;
    }
    // class-level docs / imports / class line: reset any stray doc buffer
    if (/^\s*(export class|import|\}|@Injectable)/.test(raw) || raw.trim() === '') {
      if (!/^\s*$/.test(raw)) doc = [];
    }
  }
  return fields;
}

function buildZodExpr(name: string, metas: ValidationMeta[]): string {
  if (OVERRIDES[name]) return OVERRIDES[name];
  const has = (n: string) => metas.some((m) => m.name === n);
  const con = (n: string) => metas.find((m) => m.name === n)?.constraints?.[0];

  if (has('isNumber')) {
    let expr = 'z.number()';
    const min = con('min');
    const max = con('max');
    if (typeof min === 'number') expr += `.min(${min})`;
    if (typeof max === 'number') expr += `.max(${max})`;
    return expr;
  }
  if (has('isBoolean')) return 'z.boolean()';
  if (has('isIn')) {
    const values = con('isIn');
    if (!Array.isArray(values)) throw new Error(`@IsIn without values: ${name}`);
    return `z.enum([${values.map((v) => JSON.stringify(v)).join(', ')}])`;
  }
  if (has('isArray')) return 'z.array(z.string())';
  if (has('isObject')) {
    const shape = OBJECT_SHAPES[name];
    if (!shape) {
      throw new Error(
        `@IsObject field "${name}" has no OBJECT_SHAPES entry — add the deep zod shape in the generator.`,
      );
    }
    return shape;
  }
  if (has('isString')) {
    let expr = 'z.string()';
    const max = con('maxLength');
    if (typeof max === 'number') expr += `.max(${max})`;
    return expr;
  }
  throw new Error(`Unsupported validation metadata for "${name}" — extend the generator.`);
}

function emitSchema(fields: FieldSource[], metaByField: Record<string, ValidationMeta[]>): string {
  const schemaLines: string[] = [];
  const defaultLines: string[] = [];
  let currentSection: string | null | undefined;

  for (const f of fields) {
    if (f.section !== currentSection) {
      schemaLines.push(`  // ── ${f.section} ──`);
      currentSection = f.section;
    }
    for (const d of f.doc) schemaLines.push(`  // ${d}`);
    schemaLines.push(`  ${f.name}: ${buildZodExpr(f.name, metaByField[f.name] ?? [])},`);
    defaultLines.push(`  ${f.name}: ${JSON.stringify(DEFAULT_SETTINGS[f.name as keyof typeof DEFAULT_SETTINGS])},`);
  }

  return `/* AUTO-GENERATED FILE — DO NOT EDIT.
 *
 * Single source of truth for the webui kernel-settings contract (P2.1):
 *   constraints → vinhnt-agent UpdateKernelSettingsDto (class-validator)
 *   defaults    → vinhnt-agent AgentSettingsService.DEFAULT_SETTINGS
 *   order/docs  → DTO declaration order
 *
 * Regenerate: pnpm --dir ../vinhnt-agent gen:webui-schema
 * Script:     vinhnt-agent/scripts/generate-webui-settings-schema.ts
 * (Intentional webui overrides — see the script header: compactionThreshold
 * ratio-only 0.05-1, deep shapes for the two @IsObject permission maps.)
 */
import { z } from "zod";

export const kernelSettingsSchema = z.object({
${schemaLines.join('\n')}
});

export type KernelSettingsInput = z.infer<typeof kernelSettingsSchema>;

export const defaultKernelSettings: KernelSettingsInput = {
${defaultLines.join('\n')}
};
`;
}

function main(): void {
  const storage = getMetadataStorage();
  const metas = storage.getTargetValidationMetadatas(UpdateKernelSettingsDto, '', false, false);
  const metaByField: Record<string, ValidationMeta[]> = {};
  for (const m of metas) {
    (metaByField[m.propertyName] ??= []).push(m);
  }
  const dtoFields = parseDtoSource();

  if (dtoFields.length === 0) throw new Error('No DTO fields parsed — source scan failed.');

  // Coverage gates: DTO ⇄ DEFAULT_SETTINGS must stay in lockstep.
  const dtoNames = new Set(dtoFields.map((f) => f.name));
  const defaultNames = new Set(Object.keys(DEFAULT_SETTINGS));
  const missingDefaults = [...dtoNames].filter((n) => !defaultNames.has(n));
  const extraDefaults = [...defaultNames].filter((n) => !dtoNames.has(n));
  if (missingDefaults.length || extraDefaults.length) {
    throw new Error(
      `DTO/DEFAULT_SETTINGS drift — missing in defaults: [${missingDefaults.join(', ')}]; ` +
        `not exposed in DTO: [${extraDefaults.join(', ')}].`,
    );
  }
  const missingMeta = dtoFields.filter((f) => !metaByField[f.name]?.length).map((f) => f.name);
  if (missingMeta.length) {
    throw new Error(`DTO fields without class-validator metadata: [${missingMeta.join(', ')}].`);
  }

  const outFlag = process.argv.indexOf('--out');
  const outPath =
    outFlag >= 0 && process.argv[outFlag + 1]
      ? path.resolve(process.argv[outFlag + 1])
      : path.resolve(
          __dirname,
          '../../vinhnt-webui/src/features/settings/schemas/agent-settings.schema.generated.ts',
        );

  const content = emitSchema(dtoFields, metaByField);
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Generated ${dtoFields.length} fields → ${outPath}`);
}

main();
