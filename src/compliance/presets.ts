import { Preset, Policy } from './types.js';

const PERMISSIVE_LICENSES = [
  'MIT',
  'MIT-0',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'CC0-1.0',
  'Unlicense',
  '0BSD',
  'BSL-1.0',
  'Zlib',
  'Artistic-2.0',
  'Python-2.0',
  'WTFPL',
  'CC-BY-4.0',
  'BlueOak-1.0.0',
  'Unicode-DFS-2015',
  'NCSA',
];

const WEAK_COPYLEFT = [
  // LGPL family: deprecated form + modern SPDX variants
  'LGPL-2.1',
  'LGPL-2.1-only',
  'LGPL-2.1-or-later',
  'LGPL-3.0',
  'LGPL-3.0-only',
  'LGPL-3.0-or-later',
  'MPL-2.0',
  'EPL-1.0',
  'EPL-2.0',
  'CDDL-1.0',
  'EUPL-1.2',
  'PostgreSQL',
];

const STRONG_COPYLEFT = [
  // GPL family: deprecated form + modern SPDX variants
  'GPL-2.0',
  'GPL-2.0-only',
  'GPL-2.0-or-later',
  'GPL-3.0',
  'GPL-3.0-only',
  'GPL-3.0-or-later',
  'AGPL-1.0',
  // AGPL v3: deprecated form + modern SPDX variants
  'AGPL-3.0',
  'AGPL-3.0-only',
  'AGPL-3.0-or-later',
  'SSPL-1.0',
  'OSL-3.0',
  'RPL-1.5',
];

const presetDefinitions: Record<Preset, Policy> = {
  none: {
    allow: [],
    review: [],
    deny: [],
  },

  permissive: {
    allow: [...PERMISSIVE_LICENSES],
    review: [],
    deny: [],
  },

  commercial: {
    allow: [...PERMISSIVE_LICENSES, ...WEAK_COPYLEFT],
    review: [],
    deny: [...STRONG_COPYLEFT],
  },

  enterprise: {
    allow: [...PERMISSIVE_LICENSES],
    review: [],
    deny: [...STRONG_COPYLEFT, ...WEAK_COPYLEFT],
  },

  oss: {
    allow: [],
    review: [],
    deny: [],
  },

  strict: {
    allow: [],
    review: [],
    deny: [],
  },
};

export type ResolvedPolicy = Required<Omit<Policy, 'preset'>> & {
  preset: Preset | undefined;
  allowLower: Set<string>;
  reviewLower: Set<string>;
  denyLower: Set<string>;
};

function toLowerSet(arr: string[]): Set<string> {
  return new Set(arr.map((s) => s.toLowerCase()));
}

export function resolvePolicy(policy: Policy): ResolvedPolicy {
  const def = policy.preset ? presetDefinitions[policy.preset] : { allow: [] as string[], review: [] as string[], deny: [] as string[] };
  const allow = policy.allow ?? def.allow ?? [];
  const review = policy.review ?? def.review ?? [];
  const deny = policy.deny ?? def.deny ?? [];

  return {
    preset: policy.preset || undefined,
    allow,
    review,
    deny,
    allowLower: toLowerSet(allow),
    reviewLower: toLowerSet(review),
    denyLower: toLowerSet(deny),
  };
}

export function getDefaultPolicy(): Policy {
  return { preset: 'commercial' };
}
