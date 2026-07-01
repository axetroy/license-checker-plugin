import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export class JsonFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const result = items.map((item) => ({
      name: item.package.name,
      version: item.package.version,
      license: item.license.license,
      repository: item.license.repository,
      homepage: item.license.homepage,
      author: item.license.author,
    }));

    return JSON.stringify(result, null, 2);
  }
}
