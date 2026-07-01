import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export interface TxtFormatterOptions {
  includeLicenseText?: boolean;
}

const LABELS = {
  packageName: 'Package Name',
  version: 'Version',
  license: 'License',
  repository: 'Repository',
  homepage: 'Homepage',
  author: 'Author',
  licenseText: 'License Text',
} as const;

const LABEL_WIDTH = Math.max(...Object.values(LABELS).map((l) => l.length));

function pad(label: string): string {
  return label.padEnd(LABEL_WIDTH);
}

function formatAuthor(author: string): string {
  const angleIdx = author.lastIndexOf('<');
  const closeIdx = author.lastIndexOf('>');
  if (angleIdx !== -1 && closeIdx > angleIdx) {
    const name = author.slice(0, angleIdx).trim();
    const email = author.slice(angleIdx + 1, closeIdx).trim();
    return name ? `${name} <a>${email}</a>` : `<a>${email}</a>`;
  }
  return author;
}

export class TxtFormatter implements Formatter {
  constructor(private readonly options: TxtFormatterOptions = {}) {}

  generate(items: OutputItem[]): string {
    const lines: string[] = ['# THIRD-PARTY LICENSES', ''];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      lines.push(`${pad(LABELS.packageName)} : ${item.package.name}`);
      lines.push(`${pad(LABELS.version)} : ${item.package.version}`);
      lines.push(`${pad(LABELS.license)} : ${item.license.license}`);

      if (item.license.repository) {
        lines.push(`${pad(LABELS.repository)} : ${item.license.repository}`);
      }
      if (item.license.homepage) {
        lines.push(`${pad(LABELS.homepage)} : ${item.license.homepage}`);
      }
      if (item.license.author) {
        lines.push(`${pad(LABELS.author)} : ${formatAuthor(item.license.author)}`);
      }

      if (this.options.includeLicenseText !== false && item.license.licenseText) {
        lines.push('');
        lines.push(`${pad(LABELS.licenseText)} :`);
        lines.push(item.license.licenseText);
      }

      lines.push('');

      if (i < items.length - 1) {
        lines.push('---');
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
