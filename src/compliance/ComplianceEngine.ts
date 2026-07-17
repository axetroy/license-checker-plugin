import spdxExpressionParse from 'spdx-expression-parse';
import { Policy, ComplianceStatus, ComplianceResult, ComplianceReport, LicenseSeverity } from './types.js';
import { resolvePolicy, ResolvedPolicy } from './presets.js';

const STATUS_ORDER: Record<ComplianceStatus, number> = { PASS: 0, REVIEW: 1, FAIL: 2 };

function bestOf(a: ComplianceStatus, b: ComplianceStatus): ComplianceStatus {
  return STATUS_ORDER[a] < STATUS_ORDER[b] ? a : b;
}

function worstOf(a: ComplianceStatus, b: ComplianceStatus): ComplianceStatus {
  return STATUS_ORDER[a] > STATUS_ORDER[b] ? a : b;
}

interface ParsedIds {
  identifiers: string[];
  conjunction: 'and' | 'or';
}

function parseSpdxIdentifiers(license: string): ParsedIds | null {
  try {
    const node = spdxExpressionParse(license);
    const identifiers: string[] = [];
    const walk = (n: typeof node): void => {
      if ('license' in n) {
        identifiers.push((n as { license: string }).license);
      } else {
        const expr = n as { left: typeof node; right: typeof node; conjunction: string };
        walk(expr.left);
        walk(expr.right);
      }
    };
    walk(node);

    if (identifiers.length === 0) return null;

    // Determine conjunction from the top-level node
    let conjunction: 'and' | 'or' = 'or';
    if (!('license' in node)) {
      conjunction = (node as { conjunction: string }).conjunction as 'and' | 'or';
    }

    return { identifiers, conjunction };
  } catch {
    return null;
  }
}

function evaluateSingle(id: string, policy: ResolvedPolicy): ComplianceResult {
  const idLower = id.toLowerCase();
  if (policy.denyLower.has(idLower)) {
    return { status: 'FAIL', reasons: [`License "${id}" is denied by policy`] };
  }
  if (policy.allowLower.has(idLower)) {
    return { status: 'PASS', reasons: [] };
  }
  if (policy.reviewLower.has(idLower)) {
    return { status: 'REVIEW', reasons: [`License "${id}" requires review`] };
  }
  // Not in any list — depends on preset
  if (policy.preset === 'strict') {
    return { status: 'FAIL', reasons: [`License "${id}" is not in the allow list (strict mode)`] };
  }
  if (policy.preset === 'none' || policy.preset === 'oss') {
    return { status: 'PASS', reasons: [] };
  }
  return { status: 'REVIEW', reasons: [`License "${id}" is not explicitly allowed`] };
}

function evaluateLicenseResolved(license: string, resolved: ResolvedPolicy): ComplianceResult {
  if (resolved.allow.length === 0 && resolved.deny.length === 0 && resolved.review.length === 0) {
    return { status: 'PASS', reasons: [] };
  }

  const parsed = parseSpdxIdentifiers(license);
  if (!parsed) {
    if (resolved.preset === 'strict') {
      return { status: 'FAIL', reasons: [`Unable to parse SPDX expression "${license}"`] };
    }
    return { status: 'REVIEW', reasons: [`Unable to parse SPDX expression "${license}"`] };
  }

  const results = parsed.identifiers.map((id) => evaluateSingle(id, resolved));
  const combine = parsed.conjunction === 'or' ? bestOf : worstOf;
  const finalStatus = results.reduce((acc, r) => combine(acc, r.status), results[0].status);
  const allReasons = results.flatMap((r) => r.reasons);

  return { status: finalStatus, reasons: allReasons };
}

export function evaluateLicense(license: string, policy: Policy): ComplianceResult {
  const resolved = resolvePolicy(policy);
  return evaluateLicenseResolved(license, resolved);
}

export function evaluateUnknownLicense(severity: LicenseSeverity): ComplianceResult {
  switch (severity) {
    case 'ignore':
      return { status: 'PASS', reasons: [] };
    case 'warn':
      return { status: 'REVIEW', reasons: ['License is UNKNOWN'] };
    case 'error':
      return { status: 'FAIL', reasons: ['License is UNKNOWN'] };
  }
}

export function evaluateMissingLicense(severity: LicenseSeverity): ComplianceResult {
  switch (severity) {
    case 'ignore':
      return { status: 'PASS', reasons: [] };
    case 'warn':
      return { status: 'REVIEW', reasons: ['License information is missing'] };
    case 'error':
      return { status: 'FAIL', reasons: ['License information is missing'] };
  }
}

export function buildComplianceReport(
  entries: Array<{ packageName: string; license: string }>,
  policy: Policy,
  unknownSeverity: LicenseSeverity,
  missingSeverity: LicenseSeverity,
): ComplianceReport {
  const resolved = resolvePolicy(policy);
  
  const report: ComplianceReport = {
    overall: 'PASS',
    packages: new Map(),
    warnings: [],
    errors: [],
  };

  for (const entry of entries) {
    let result: ComplianceResult;

    if (entry.license === 'UNKNOWN') {
      result = evaluateUnknownLicense(unknownSeverity);
    } else if (!entry.license || entry.license.trim() === '') {
      result = evaluateMissingLicense(missingSeverity);
    } else {
      result = evaluateLicenseResolved(entry.license, resolved);
    }

    report.packages.set(entry.packageName, result);

    if (result.status === 'FAIL') {
      report.overall = 'FAIL';
      report.errors.push(...result.reasons.map((r) => `[${entry.packageName}] ${r}`));
    } else if (result.status === 'REVIEW') {
      if (report.overall !== 'FAIL') report.overall = 'REVIEW';
      report.warnings.push(...result.reasons.map((r) => `[${entry.packageName}] ${r}`));
    }
  }

  return report;
}
