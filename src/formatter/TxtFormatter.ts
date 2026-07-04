import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export interface TxtFormatterOptions {
  includeLicenseText?: boolean;
}



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

      if (item.package.repository) {
        lines.push(this.formatField('Repository', item.package.repository, labelWidth));
      }
      if (item.package.author) {
        lines.push(this.formatField('Author', this.formatAuthor(item.package.author), labelWidth));
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
    if (!match) return author.trim();
    const name = match[1].trim();
    const email = match[2].trim();
    return name ? `${name} <${email}>` : `<${email}>`;
  }
}
