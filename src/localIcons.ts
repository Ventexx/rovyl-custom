import type { AppItem } from './types';

export function isLikelyWebUrl(command: string | undefined): boolean {
  return /^https?:\/\//i.test(String(command ?? '').trim());
}

/** Web shortcuts use a bundled glyph; merely displaying one never contacts its site. */
export function websiteIconFields(value: string): Pick<AppItem, 'customIconUrl' | 'iconSource' | 'iconName'> | null {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return { customIconUrl: undefined, iconSource: 'lucide', iconName: 'Globe' };
  } catch {
    return null;
  }
}

/** Ignore network images in older settings/backups before an image element can request them. */
export function isLocalIcon(value: string | undefined): boolean {
  const source = String(value ?? '').trim();
  if (!source || source.startsWith('//') || source.startsWith('\\\\')) return false;
  if (/^data:image\//i.test(source) || /^blob:/i.test(source)) return true;
  if (/^file:/i.test(source)) {
    try { return !new URL(source).hostname; } catch { return false; }
  }
  return !/^[a-z][a-z\d+.-]*:/i.test(source);
}
