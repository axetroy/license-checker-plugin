import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export interface TxtFormatterOptions {
  includeLicenseText?: boolean;
}

export class TxtFormatter implements Formatter {
  constructor(private readonly options: TxtFormatterOptions = {}) {}

  generate(items: OutputItem[]): string {
    const lines: string[] = ['Third Party Licenses', ''];

    for (const item of items) {
      lines.push('====================================');
      lines.push(`Package: ${item.package.name}`);
      lines.push(`Version: ${item.package.version}`);
      lines.push(`License: ${item.license.license}`);

      if (item.license.repository) {
        lines.push(`Repository: ${item.license.repository}`);
      }
      if (item.license.homepage) {
        lines.push(`Homepage: ${item.license.homepage}`);
      }
      if (item.license.author) {
        lines.push(`Author: ${item.license.author}`);
      }

      if (this.options.includeLicenseText !== false && item.license.licenseText) {
        lines.push('');
        lines.push('License File:');
        lines.push(item.license.licenseText);
      }

      lines.push('');
    }

    if (items.length > 0) {
      lines.push('====================================');
    }

    return lines.join('\n');
  }
}
