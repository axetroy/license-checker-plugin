import { OutputItem } from '../model/LicenseInfo';

export interface Formatter {
  generate(items: OutputItem[]): string;
}
