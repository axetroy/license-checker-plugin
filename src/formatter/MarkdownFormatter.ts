import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export class MarkdownFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const lines: string[] = [
      '# Third Party Licenses',
      '',
      '| Package | Version | License |',
      '|---------|---------|---------|',
    ];

    for (const item of items) {
      lines.push(`| ${item.package.name} | ${item.package.version} | ${item.license.license} |`);
    }

    return `${lines.join('\n')}\n`;
  }
}
