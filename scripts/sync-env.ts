/**
 * Sync .env with .env.example:
 * - Creates or merges .env from .env.example (preserves existing .env values).
 * - Fills missing keys: example non-empty values win, else --default.
 * - Appends keys that exist only in .env to .env.example (template sync).
 *
 * Usage:
 *   bun run scripts/sync-env.ts [--default <string>] [--example <path>] [--out <path>]
 *                              [--sync-values] [--no-to-example]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

function parseArgs(argv: string[]) {
  let def = ''
  let examplePath = resolve(ROOT, '.env.example')
  let outPath = resolve(ROOT, '.env')
  let syncValuesToExample = false
  let pushToExample = true

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--default' && argv[i + 1] !== undefined) {
      def = argv[++i]
      continue
    }
    if (a === '--example' && argv[i + 1] !== undefined) {
      examplePath = resolve(ROOT, argv[++i])
      continue
    }
    if (a === '--out' && argv[i + 1] !== undefined) {
      outPath = resolve(ROOT, argv[++i])
      continue
    }
    if (a === '--sync-values') {
      syncValuesToExample = true
      continue
    }
    if (a === '--no-to-example') {
      pushToExample = false
      continue
    }
    if (a === '-h' || a === '--help') {
      console.log(`Usage: bun run scripts/sync-env.ts [options]

Options:
  --default <s>     Value for keys that are empty in .env.example (default: "")
  --example <path>  Template file (default: .env.example)
  --out <path>      Local env file (default: .env)
  --sync-values      When updating .env.example, copy values from .env (unsafe for secrets)
  --no-to-example    Do not append new .env keys to .env.example
`)
      process.exit(0)
    }
  }

  return { def, examplePath, outPath, syncValuesToExample, pushToExample }
}

type Line =
  | { kind: 'raw'; text: string }
  | { kind: 'kv'; key: string; rawValue: string; indent: string }

function parseEnvFile(content: string): Line[] {
  const lines = content.split(/\r?\n/)
  const out: Line[] = []
  const kv = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/

  for (const line of lines) {
    const t = line.trimStart()
    if (t.startsWith('#') || line === '') {
      out.push({ kind: 'raw', text: line })
      continue
    }
    const m = line.match(kv)
    if (m) {
      const [, indent, key, rest] = m
      out.push({ kind: 'kv', key, rawValue: rest, indent: indent ?? '' })
    } else {
      out.push({ kind: 'raw', text: line })
    }
  }
  return out
}

function linesToMap(lines: Line[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const l of lines) {
    if (l.kind === 'kv') {
      m.set(l.key, l.rawValue)
    }
  }
  return m
}

function stringifyValue(v: string): string {
  const needsQuote = /[\s#"'`=]/.test(v) || v === ''
  if (!needsQuote) {
    return v
  }
  const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `"${escaped}"`
}

function main() {
  const { def, examplePath, outPath, syncValuesToExample, pushToExample } = parseArgs(
    process.argv.slice(2)
  )

  if (!existsSync(examplePath)) {
    console.error(`Missing template: ${examplePath}`)
    process.exit(1)
  }

  const exampleContent = readFileSync(examplePath, 'utf8')
  const exampleLines = parseEnvFile(exampleContent)

  const envContent = existsSync(outPath) ? readFileSync(outPath, 'utf8') : ''
  const envLines = parseEnvFile(envContent)
  const envMap = linesToMap(envLines)
  const exampleKeySet = new Set<string>()
  for (const l of exampleLines) {
    if (l.kind === 'kv') {
      exampleKeySet.add(l.key)
    }
  }

  // Build merged .env from example order
  const merged: string[] = []
  for (const l of exampleLines) {
    if (l.kind === 'raw') {
      merged.push(l.text)
      continue
    }
    const existing = envMap.get(l.key)
    if (existing !== undefined) {
      merged.push(`${l.indent}${l.key}=${existing}`)
      continue
    }
    const exampleVal = l.rawValue.trim()
    let valueForNew: string
    if (exampleVal !== '') {
      valueForNew = l.rawValue
    } else if (def === '') {
      valueForNew = ''
    } else {
      valueForNew = stringifyValue(def)
    }
    merged.push(`${l.indent}${l.key}=${valueForNew}`)
  }

  // Append env-only keys (user added locally), preserve their blocks from tail of .env
  const extraKeys: string[] = []
  for (const k of envMap.keys()) {
    if (!exampleKeySet.has(k)) {
      extraKeys.push(k)
    }
  }

  if (extraKeys.length > 0) {
    const seen = new Set<string>()
    if (merged.length > 0 && merged[merged.length - 1] !== '') {
      merged.push('')
    }
    merged.push('# Keys present in local .env only:')
    for (const l of envLines) {
      if (l.kind !== 'kv' || !extraKeys.includes(l.key) || seen.has(l.key)) {
        continue
      }
      seen.add(l.key)
      merged.push(`${l.indent}${l.key}=${l.rawValue}`)
    }
  }

  const nextEnv = merged.join('\n').replace(/\n+$/, '') + '\n'
  writeFileSync(outPath, nextEnv, 'utf8')
  console.info(`Wrote ${outPath}`)

  if (extraKeys.length === 0) {
    console.info('No extra keys in .env beyond .env.example.')
    return
  }

  if (!pushToExample) {
    console.info(
      `Skipping .env.example update (--no-to-example); ${extraKeys.length} local-only key(s) not pushed.`
    )
    return
  }

  // Sync new keys → .env.example

  let exampleAppend = '\n# --- synced from local .env ---\n'
  for (const k of extraKeys) {
    const v = envMap.get(k) ?? ''
    const safeVal = syncValuesToExample ? v : ''
    exampleAppend += `${k}=${safeVal}\n`
  }

  if (!syncValuesToExample && extraKeys.length > 0) {
    console.info(
      'Appended new keys to .env.example with empty values (omit secrets). Use --sync-values to copy values.'
    )
  }

  // Replace previous sync tail so repeat runs do not duplicate this block (keep manual template above the marker).
  const withoutSyncTail = exampleContent.replace(
    /\r?\n# --- synced from local \.env ---[\s\S]*$/,
    ''
  )
  writeFileSync(examplePath, withoutSyncTail.replace(/\s+$/, '') + exampleAppend, 'utf8')
  console.info(`Updated ${examplePath} (${extraKeys.length} key(s)).`)
}

main()
