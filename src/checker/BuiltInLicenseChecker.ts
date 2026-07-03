import { readFile, readdir, stat } from 'fs/promises';
import * as path from 'path';
import spdxExpressionParse from 'spdx-expression-parse';

export interface LicenseCheckerOptions {
  start: string;
  excludePrivatePackages?: boolean;
  customFormat?: Record<string, unknown>;
}

export interface PackageLicenseInfo {
  name?: string;
  version?: string;
  licenses?: string | string[];
  licenseFile?: string;
  licenseText?: string;
  repository?: string;
  publisher?: string;
  email?: string;
  url?: string;
  homepage?: string;
  private?: boolean;
  path?: string;
  copyright?: string;
}

const LICENSE_BASENAMES = [
  /^LICENSE$/i,
  /^LICENSE\-\w+$/i,
  /^LICENCE$/i,
  /^LICENCE\-\w+$/i,
  /^MIT-LICENSE$/i,
  /^COPYING$/i,
  /^COPYRIGHT$/i,
];

type LicensePattern = [RegExp, string];
const LICENSE_PATTERNS: LicensePattern[] = [
  [/permission is hereby granted, free of charge, to any person obtaining a copy of this software/i, 'MIT*'],
  [/redistribution and use in source and binary forms, with or without modification, are permitted/i, 'BSD*'],
  [/licensed under the apache license, version 2\.0/i, 'Apache-2.0*'],
  [/apache license[\s\n]+version[\s\n]+2/i, 'Apache-2.0*'],
  [/the isc license/i, 'ISC*'],
  [/\bMIT\b/, 'MIT*'],
  [/\bApache(?:\s+License)?\b/i, 'Apache*'],
  [/\bBSD\b/, 'BSD*'],
  [/\bISC\b/, 'ISC*'],
  [/gnu general public license/i, 'GPL*'],
  [/gnu lesser\/library general public license/i, 'LGPL*'],
  [/cc0 1\.0 universal/i, 'CC0-1.0*'],
  [/public domain/i, 'Public Domain'],
  [/do what the f\*ck you want to public license/i, 'WTFPL*'],
];

const COPYRIGHT_PATTERNS = [
  /©?\s*copyright\s+(?:\(c\)\s*)?(\d{4}(?:\s*-\s*\d{4})?)\s+([^\n\r]+)/gi,
  /©\s*(\d{4}(?:\s*-\s*\d{4})?)\s+([^\n\r]+)/gi,
];

export function normalizeLicense(license: string): string {
  try {
    spdxExpressionParse(license);
    return license;
  } catch {
    return 'Custom';
  }
}

function extractCopyright(content: string): string | undefined {
  const copyrightLines: string[] = [];

  for (const pattern of COPYRIGHT_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      let copyright = match[0];
      copyright = copyright.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      if (!copyrightLines.includes(copyright)) {
        copyrightLines.push(copyright);
      }
    }
    pattern.lastIndex = 0;
  }

  if (copyrightLines.length > 0) {
    return copyrightLines[0];
  }

  return undefined;
}

async function findLicenseFile(packageDir: string): Promise<string | null> {
  try {
    const files = await readdir(packageDir);
    const candidates: Array<{ file: string; order: number }> = [];

    for (const file of files) {
      const fullPath = path.join(packageDir, file);
      try {
        if (!(await stat(fullPath)).isFile()) continue;
      } catch {
        continue;
      }

      for (let i = 0; i < LICENSE_BASENAMES.length; i++) {
        if (LICENSE_BASENAMES[i].test(file)) {
          candidates.push({ file: fullPath, order: i });
          break;
        }
      }
    }

    candidates.sort((a, b) => a.order - b.order);
    return candidates.length > 0 ? candidates[0].file : null;
  } catch {
    return null;
  }
}

async function readPackageJson(packageJsonPath: string): Promise<{
  name?: string; version?: string; license?: string | object;
  licenses?: string | object[]; repository?: string | object;
  author?: string | object; homepage?: string; private?: boolean
} | null> {
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getLicenseString(license: string | object | undefined): string | undefined {
  if (!license) return undefined;
  if (typeof license === 'string') return license;
  if (typeof license === 'object' && 'type' in license) {
    return String((license as { type: string }).type);
  }
  return undefined;
}

export function normalizeRepositoryUrl(repo: string): string {
  return repo
    .replace(/^git\+https:\/\//, 'https://')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git\+ssh:\/\/git@/, 'https://')
    .replace(/^git\+ssh:\/\//, 'https://')
    .replace(/\.git$/, '');
}

function getRepositoryUrl(repository: string | object | undefined): string | undefined {
  if (!repository) return undefined;
  if (typeof repository === 'string') {
    let url = normalizeRepositoryUrl(repository);
    const scpMatch = url.match(/^https:\/\/([^:/]+):(.+)$/);
    if (scpMatch) {
      url = `https://${scpMatch[1]}/${scpMatch[2]}`;
    }
    return url;
  }
  if (typeof repository === 'object' && 'url' in repository) {
    return getRepositoryUrl((repository as { url: string }).url);
  }
  return undefined;
}

export function parseAuthor(author: string | object | undefined): { name?: string; email?: string } {
  if (!author) return {};
  if (typeof author === 'string') {
    const match = author.match(/^(.+?)(?:\s*<([^>]+)>)?$/);
    if (match) {
      return { name: match[1].trim(), email: match[2] };
    }
    return { name: author };
  }
  if (typeof author === 'object' && 'name' in author) {
    const a = author as { name?: string; email?: string };
    return { name: a.name, email: a.email };
  }
  return {};
}

async function findPackages(startPath: string): Promise<string[]> {
  const packages: string[] = [];
  const visited = new Set<string>();

  async function scan(nodeModulesPath: string): Promise<void> {
    if (visited.has(nodeModulesPath)) return;
    visited.add(nodeModulesPath);

    try {
      await stat(nodeModulesPath);
    } catch {
      return;
    }

    try {
      const entries = await readdir(nodeModulesPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;

        if (entry.name.startsWith('@')) {
          const scopeDir = path.join(nodeModulesPath, entry.name);
          try {
            const scopeEntries = await readdir(scopeDir, { withFileTypes: true });
            for (const scopeEntry of scopeEntries) {
              if (!scopeEntry.isDirectory()) continue;
              const pkgPath = path.join(scopeDir, scopeEntry.name);
              try {
                await stat(path.join(pkgPath, 'package.json'));
                packages.push(pkgPath);
                // Recursively scan nested node_modules
                await scan(path.join(pkgPath, 'node_modules'));
              } catch {
                // Skip packages without package.json
              }
            }
          } catch {
            // Ignore errors
          }
        } else {
          const pkgPath = path.join(nodeModulesPath, entry.name);
          try {
            await stat(path.join(pkgPath, 'package.json'));
            packages.push(pkgPath);
            // Recursively scan nested node_modules
            await scan(path.join(pkgPath, 'node_modules'));
          } catch {
            // Skip packages without package.json
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  await scan(path.join(startPath, 'node_modules'));
  return packages;
}

async function processPackage(
  packagePath: string,
  options: LicenseCheckerOptions
): Promise<[string, PackageLicenseInfo] | null> {
  const packageJson = await readPackageJson(path.join(packagePath, 'package.json'));
  if (!packageJson) return null;

  if (options.excludePrivatePackages && packageJson.private === true) {
    return null;
  }

  let licenses: string | string[] | undefined;
  if (packageJson.license) {
    licenses = getLicenseString(packageJson.license);
  } else if (packageJson.licenses) {
    if (Array.isArray(packageJson.licenses)) {
      licenses = packageJson.licenses.map((l) => getLicenseString(l) || 'UNKNOWN').filter(Boolean) as string[];
    } else {
      licenses = getLicenseString(packageJson.licenses);
    }
  }

  const licenseFile = await findLicenseFile(packagePath);
  let licenseText: string | undefined;
  let copyright: string | undefined;

  if (licenseFile && options.customFormat?.licenseText) {
    try {
      licenseText = await readFile(licenseFile, 'utf-8');
      copyright = extractCopyright(licenseText);
    } catch {
      // Ignore errors
    }
  }

  const authorInfo = parseAuthor(packageJson.author);
  const name = packageJson.name || path.basename(packagePath);
  const version = packageJson.version || '0.0.0';

  return [
    `${name}@${version}`,
    {
      name,
      version,
      licenses,
      licenseFile: licenseFile || undefined,
      licenseText,
      copyright,
      repository: getRepositoryUrl(packageJson.repository),
      publisher: authorInfo.name,
      email: authorInfo.email,
      url: packageJson.homepage,
      private: packageJson.private === true,
      path: packagePath,
    },
  ];
}

export async function builtInLicenseChecker(
  options: LicenseCheckerOptions
): Promise<Record<string, PackageLicenseInfo>> {
  const startPath = path.resolve(options.start);

  try {
    await stat(startPath);
  } catch {
    throw new Error(`Path does not exist: ${startPath}`);
  }

  const packagePaths = await findPackages(startPath);
  const results = await Promise.all(packagePaths.map((pkgPath) => processPackage(pkgPath, options)));

  const packages: Record<string, PackageLicenseInfo> = {};
  for (const result of results) {
    if (result) {
      packages[result[0]] = result[1];
    }
  }

  return packages;
}
