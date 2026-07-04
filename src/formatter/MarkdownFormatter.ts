import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export class MarkdownFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const hasLicenseText = items.some((item) => item.license.licenseText);

    const lines: string[] = [
      '# Third Party Licenses',
      '',
      hasLicenseText
        ? '| Package | Version | License | License Text |'
        : '| Package | Version | License |',
      hasLicenseText
        ? '|---------|---------|---------|--------------|'
        : '|---------|---------|---------|',
    ];

    for (const item of items) {
      const name = this.escapeForMarkdown(item.package.name);
      const version = this.escapeForMarkdown(item.package.version);
      const license = this.escapeForMarkdown(item.license.license);
      
      if (hasLicenseText) {
        const licenseText = item.license.licenseText
          ? this.escapeForMarkdown(item.license.licenseText).replace(/\n/g, '<br>')
          : '';
        lines.push(`| ${name} | ${version} | ${license} | ${licenseText} |`);
      } else {
        lines.push(`| ${name} | ${version} | ${license} |`);
      }
    }

    return `${lines.join('\n')}\n`;
  }

  private escapeForMarkdown(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\|/g, '\\|');
  }
}
