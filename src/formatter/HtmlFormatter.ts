import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export class HtmlFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const rows = items
      .map((item) => {
        const name = this.escape(item.package.name);
        const version = this.escape(item.package.version);
        const license = this.escape(item.license.license);
        const licenseText = item.license.licenseText
          ? `<details><summary>View License</summary><pre>${this.escape(item.license.licenseText)}</pre></details>`
          : '';

        return `  <tr>\n    <td>${name}</td>\n    <td>${version}</td>\n    <td>${license}</td>\n    <td>${licenseText}</td>\n  </tr>`;
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
  </style>
</head>
<body>
  <h1>Third Party Licenses</h1>
  <table>
    <thead>
      <tr><th>Package</th><th>Version</th><th>License</th><th>License Text</th></tr>
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
