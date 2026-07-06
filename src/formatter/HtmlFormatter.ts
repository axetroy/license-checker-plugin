import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export class HtmlFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const hasDirect = items.some((item) => item.package.direct !== undefined);
    const hasDependencyPath = items.some((item) => item.package.dependencyPath !== undefined);
    const hasLicenseText = items.some((item) => item.license.licenseText);

    const headers = ['Package', 'Version', 'License'];
    if (hasDirect) headers.push('Direct');
    if (hasDependencyPath) headers.push('Dependency Path');
    if (hasLicenseText) headers.push('License Text');

    const headerRow = '<tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr>';

    const rows = items
      .map((item) => {
        const name = this.escape(item.package.name);
        const version = this.escape(item.package.version);
        const license = this.escape(item.license.license);

        const cells = [
          `<td>${name}</td>`,
          `<td>${version}</td>`,
          `<td>${license}</td>`,
        ];

        if (hasDirect) {
          cells.push(`<td>${item.package.direct ? 'true' : 'false'}</td>`);
        }
        if (hasDependencyPath) {
          const depPath = this.escape(item.package.dependencyPath || '');
          cells.push(`<td><code>${depPath}</code></td>`);
        }
        if (hasLicenseText) {
          const licenseText = item.license.licenseText
            ? `<details><summary>View License</summary><pre>${this.escape(item.license.licenseText)}</pre></details>`
            : '';
          cells.push(`<td>${licenseText}</td>`);
        }

        return '  <tr>\n    ' + cells.join('\n    ') + '\n  </tr>';
      })
      .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Third Party Licenses</title>
  <style>
    body { font-family: sans-serif; margin: 2em; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    pre { white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Third Party Licenses</h1>
  <table>
    <thead>
${headerRow}
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>
</body>
</html>
`;
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
