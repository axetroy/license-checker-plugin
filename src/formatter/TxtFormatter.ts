import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export interface TxtFormatterOptions {
  includeLicenseText?: boolean;
}

// Lightweight validation to detect common email strings without enforcing full RFC rules.
const AUTHOR_EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export class TxtFormatter implements Formatter {
  constructor(private readonly options: TxtFormatterOptions = {}) {}

  generate(items: OutputItem[]): string {
    const lines: string[] = ['# THIRD-PARTY LICENSES', ''];
    const labelWidth = 'Package Name'.length;

    items.forEach((item, index) => {
      // Keep labels aligned to improve readability in plain text outputs and diffs.
      lines.push(this.formatField('Package Name', item.package.name, labelWidth));
      lines.push(this.formatField('Version', item.package.version, labelWidth));
      lines.push(this.formatField('License', item.license.license, labelWidth));

      if (item.license.repository) {
        lines.push(this.formatField('Repository', item.license.repository, labelWidth));
      }
      if (item.license.author) {
        lines.push(this.formatField('Author', this.formatAuthor(item.license.author), labelWidth));
      }

      if (this.options.includeLicenseText !== false && item.license.licenseText) {
        lines.push('');
        // Keep license bodies in a separate block because they are multi-line and don't fit label-value alignment.
        lines.push('License Text:');
        lines.push(item.license.licenseText);
      }

      if (index < items.length - 1) {
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    });

    return `${lines.join('\n')}\n`;
  }

  private formatField(label: string, value: string, width: number): string {
    return `${label.padEnd(width)} : ${value}`;
  }

  private formatAuthor(author: string): string {
    const match = author.match(/^(.*)\s*<([^>]+)>$/);
    if (!match) {
      const candidate = author.trim();
      return AUTHOR_EMAIL_PATTERN.test(candidate) ? `<a>${candidate}</a>` : candidate;
    }

    const candidate = match[2].trim();
    if (!AUTHOR_EMAIL_PATTERN.test(candidate)) {
      return author;
    }

    const name = match[1].trim();
    // Keep this exact shape to match the requested output contract: `name <a>email</a>`.
    return name ? `${name} <a>${candidate}</a>` : `<a>${candidate}</a>`;
  }
}
