import { OutputItem } from '../model/LicenseInfo.js';

export interface Formatter {
  generate(items: OutputItem[]): string;
}
