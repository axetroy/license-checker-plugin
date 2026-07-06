import { OutputItem } from '../model/LicenseInfo';
import { Formatter } from './Formatter';

export class JsonFormatter implements Formatter {
  generate(items: OutputItem[]): string {
    const result = items.map((item) => {
      const entry: Record<string, unknown> = {
        name: item.package.name,
        version: item.package.version,
        license: item.license.license,
      };
      if (item.package.repository) entry.repository = item.package.repository;
      if (item.package.homepage) entry.homepage = item.package.homepage;
      if (item.package.author) entry.author = item.package.author;
      if (item.license.licenseText) entry.licenseText = item.license.licenseText;
      if (item.package.direct !== undefined) entry.direct = item.package.direct;
      if (item.package.dependencyPath !== undefined) entry.dependencyPath = item.package.dependencyPath;
      return entry;
    });

    return JSON.stringify(result, null, 2);
  }
}
