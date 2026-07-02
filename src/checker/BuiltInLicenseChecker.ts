/**
 * Built-in license checker - zero dependency implementation
 * Replaces license-checker-rseidelsohn functionality
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export interface LicenseCheckerOptions {
  start: string;
  excludePrivatePackages?: boolean;
  production?: boolean;
  development?: boolean;
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

// License file basename patterns in precedence order
const LICENSE_BASENAMES = [
  /^LICENSE$/i,
  /^LICENSE\-\w+$/i,
  /^LICENCE$/i,
  /^LICENCE\-\w+$/i,
  /^MIT-LICENSE$/i,
  /^COPYING$/i,
  /^COPYRIGHT$/i,
];

// SPDX license identifiers that are valid
const VALID_SPDX_LICENSES = new Set([
  'MIT', 'Apache-2.0', 'Apache2', 'Apache 2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'BSD-3-Clause-Clear',
  'ISC', 'GPL-2.0', 'GPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', '0BSD', 'Unlicense', 'CC0-1.0',
  'CC-BY-3.0', 'CC-BY-4.0', 'WTFPL', 'Zlib', 'PostgreSQL', 'Python-2.0', 'Ruby', 'Artistic-2.0',
  'BSL-1.0', 'EPL-1.0', 'EPL-2.0', 'EUPL-1.1', 'EUPL-1.2', 'AGPL-3.0', 'OSL-3.0',
]);

// Regex patterns for detecting licenses in file content
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

// Copyright detection regex
const COPYRIGHT_PATTERNS = [
  /©?\s*copyright\s+(?:\(c\)\s*)?(\d{4}(?:\s*-\s*\d{4})?)\s+([^\n\r]+)/gi,
  /©\s*(\d{4}(?:\s*-\s*\d{4})?)\s+([^\n\r]+)/gi,
];

/**
 * Parse a SPDX license expression
 */
function parseSpdxExpression(license: string): string | null {
  const trimmed = license.trim();

  if (trimmed.includes(' OR ')) {
    const parts = trimmed.split(/\s+OR\s+/);
    const parsed = parts.map((p) => parseSpdxExpression(p.trim())).filter(Boolean);
    if (parsed.length > 0) {
      return parsed.join(' OR ');
    }
    return null;
  }

  if (trimmed.includes(' AND ')) {
    const parts = trimmed.split(/\s+AND\s+/);
    const parsed = parts.map((p) => parseSpdxExpression(p.trim())).filter(Boolean);
    if (parsed.length === parts.length) {
      return parsed.join(' AND ');
    }
    return null;
  }

  const parenMatch = trimmed.match(/^\(([^)]+)\)$/);
  if (parenMatch) {
    return parseSpdxExpression(parenMatch[1]);
  }

  const prefixMatch = trimmed.match(/^([A-Za-z0-9\-\.]+)(?:\s+OR\s+.*)?$/);
  if (prefixMatch) {
    const licenseId = prefixMatch[1].toUpperCase().replace(/\s+/g, '-');
    if (VALID_SPDX_LICENSES.has(licenseId)) {
      return licenseId;
    }
  }

  return null;
}

/**
 * Get license title from file content or SPDX expression
 */
function getLicenseTitle(content: string): string {
  const trimmed = content.trim();
  const spdxResult = parseSpdxExpression(trimmed);
  if (spdxResult) {
    return spdxResult;
  }

  for (const [pattern, license] of LICENSE_PATTERNS) {
    if (pattern.test(trimmed)) {
      if (license.endsWith('*')) {
        return license;
      }
      const normalized = license.toUpperCase().replace(/\s+/g, '-');
      if (VALID_SPDX_LICENSES.has(normalized)) {
        return normalized;
      }
    }
  }

  return 'UNKNOWN';
}

/**
 * Extract copyright information from license file content
 */
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

/**
 * Find license file in a package directory
 */
function findLicenseFile(packageDir: string): string | null {
  for (const basename of LICENSE_BASENAMES) {
    const licensePath = path.join(packageDir, 'LICENSE');
    if (fs.existsSync(licensePath)) {
      return licensePath;
    }
    try {
      const files = fs.readdirSync(packageDir);
      for (const file of files) {
        if (basename.test(file) && fs.statSync(path.join(packageDir, file)).isFile()) {
          return path.join(packageDir, file);
        }
      }
    } catch {
      // Ignore errors
    }
  }
  return null;
}

/**
 * Read and process package.json
 */
function readPackageJson(packageJsonPath: string): { name?: string; version?: string; license?: string | object; licenses?: string | object[]; repository?: string | object; author?: string | object; homepage?: string } | null {
  try {
    const content = fs.readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get string value from license field (can be string or { type: string })
 */
function getLicenseString(license: string | object | undefined): string | undefined {
  if (!license) return undefined;
  if (typeof license === 'string') return license;
  if (typeof license === 'object' && 'type' in license) {
    return String((license as { type: string }).type);
  }
  return undefined;
}

/**
 * Get repository URL from repository field
 */
function getRepositoryUrl(repository: string | object | undefined): string | undefined {
  if (!repository) return undefined;
  if (typeof repository === 'string') {
    let url = repository
      .replace(/^git\+https:\/\//, 'https://')
      .replace(/^git:\/\//, 'https://')
      .replace(/^git\+ssh:\/\/git@/, 'https://')
      .replace(/^git\+ssh:\/\//, 'https://')
      .replace(/\.git$/, '');
    // Handle git+ssh://git@hostname:path format (SCP-like syntax)
    // e.g., git+ssh://git@github.com:user/repo -> https://github.com/user/repo
    // After previous replacements, URL looks like: https://github.com:user/repo
    // We need to convert the colon to a slash
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

/**
 * Get author string from author field
 */
function getAuthorString(author: string | object | undefined): { publisher?: string; email?: string } {
  if (!author) return {};
  if (typeof author === 'string') {
    const match = author.match(/^(.+?)(?:\s*<([^>]+)>)?$/);
    if (match) {
      return { publisher: match[1].trim(), email: match[2] };
    }
    return { publisher: author };
  }
  if (typeof author === 'object' && 'name' in author) {
    const a = author as { name?: string; email?: string };
    return { publisher: a.name, email: a.email };
  }
  return {};
}

/**
 * Traverse node_modules to find packages
 */
function findPackages(startPath: string, maxDepth: number = 3): string[] {
  const packages: string[] = [];
  const nodeModulesPath = path.join(startPath, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    return packages;
  }

  function traverse(currentPath: string, depth: number): void {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.')) continue;
        if (entry.name.startsWith('@')) {
          const scopeDir = path.join(currentPath, entry.name);
          try {
            const scopeEntries = fs.readdirSync(scopeDir, { withFileTypes: true });
            for (const scopeEntry of scopeEntries) {
              if (!scopeEntry.isDirectory()) continue;
              const packagePath = path.join(scopeDir, scopeEntry.name);
              const packageJson = path.join(packagePath, 'package.json');
              if (fs.existsSync(packageJson)) {
                packages.push(packagePath);
              }
            }
          } catch {
            // Ignore errors
          }
        } else {
          const packagePath = path.join(currentPath, entry.name);
          const packageJson = path.join(packagePath, 'package.json');
          if (fs.existsSync(packageJson)) {
            packages.push(packagePath);
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  traverse(nodeModulesPath, 0);
  return packages;
}

/**
 * Calculate MD5 hash of file content
 */
function calculateHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

/**
 * Built-in license checker implementation
 */
export function builtInLicenseChecker(
  options: LicenseCheckerOptions,
  callback: (err: Error | null, packages: Record<string, PackageLicenseInfo>) => void
): void {
  try {
    const packages: Record<string, PackageLicenseInfo> = {};
    const startPath = path.resolve(options.start);

    if (!fs.existsSync(startPath)) {
      callback(new Error(`Path does not exist: ${startPath}`), {});
      return;
    }

    const packagePaths = findPackages(startPath);

    for (const packagePath of packagePaths) {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageJson = readPackageJson(packageJsonPath);

      if (!packageJson) continue;

      if (options.excludePrivatePackages && packageJson.name?.startsWith('@')) {
        continue;
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

      const licenseFile = findLicenseFile(packagePath);
      let licenseText: string | undefined;
      let copyright: string | undefined;

      if (licenseFile && options.customFormat?.licenseText) {
        try {
          licenseText = fs.readFileSync(licenseFile, 'utf-8');
          copyright = extractCopyright(licenseText);
        } catch {
          // Ignore errors
        }
      }

      const authorInfo = getAuthorString(packageJson.author);

      const name = packageJson.name || path.basename(packagePath);
      const version = packageJson.version || '0.0.0';
      const key = `${name}@${version}`;

      packages[key] = {
        name,
        version,
        licenses,
        licenseFile: licenseFile || undefined,
        licenseText,
        copyright,
        repository: getRepositoryUrl(packageJson.repository),
        publisher: authorInfo.publisher,
        email: authorInfo.email,
        url: packageJson.homepage,
        private: false,
        path: packagePath,
      };
    }

    callback(null, packages);
  } catch (err) {
    callback(err instanceof Error ? err : new Error(String(err)), {});
  }
}
