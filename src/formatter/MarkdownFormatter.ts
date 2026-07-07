import { OutputItem } from '../model/LicenseInfo.js';
import { Formatter } from './Formatter.js';

export class MarkdownFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const hasLicenseText = items.some((item) => item.license.licenseText);
    const hasDirect = items.some((item) => item.package.direct !== undefined);

    // Build header row based on available fields
    const columns = ['Package', 'Version', 'License'];
    if (hasDirect) columns.push('Direct');
    if (hasLicenseText) columns.push('License Text');

    const header = '| ' + columns.join(' | ') + ' |';
    const separator = '|' + columns.map(() => '-----------').join('|') + '|';

    const lines: string[] = [
      '# Third Party Licenses',
      '',
      header,
      separator,
    ];

    for (const item of items) {
      const name = this.escapeForMarkdown(item.package.name);
      const version = this.escapeForMarkdown(item.package.version);
      const license = this.escapeForMarkdown(item.license.license);

      const cells = [name, version, license];
      if (hasDirect) {
        cells.push(item.package.direct ? 'true' : 'false');
      }
      if (hasLicenseText) {
        const licenseText = item.license.licenseText
          ? this.escapeForMarkdown(item.license.licenseText).replace(/\n/g, '<br>')
          : '';
        cells.push(licenseText);
      }

      lines.push('| ' + cells.join(' | ') + ' |');
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
