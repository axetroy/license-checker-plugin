import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export class ReportFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const result = items.map((item) => ({
      name: item.package.name,
      version: item.package.version,
      chunks: item.package.chunks,
      license: item.license.license,
      repository: item.license.repository,
      homepage: item.license.homepage,
      author: item.license.author,
      licenseText: item.license.licenseText,
    }));

    return JSON.stringify(result, null, 2);
  }
}
