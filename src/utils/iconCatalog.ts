import { ICON_MAP } from '../iconMap';
import glyphs from '../data/nerd-glyphs.json';

export const ICON_CATEGORIES = [
  ['popular', 'Popular'], ['favorites', 'Favorites'], ['work', 'Work & study'],
  ['code', 'Coding'], ['games', 'Gaming'], ['media', 'Music & media'],
  ['home', 'Home & people'], ['nature', 'Nature'], ['travel', 'Travel'],
  ['shapes', 'Shapes & symbols'], ['brands', 'Brands & tools'], ['all', 'All icons'],
] as const;
const rules: Record<string, RegExp> = {
  work: /briefcase|book|school|pencil|pen |office|file|folder|calendar|clipboard|chart|presentation|graduat|notebook|calculator/,
  code: /code|terminal|console|database|server|git|bug|binary|bracket|program|docker|linux|keyboard|cpu|laptop/,
  games: /game|controller|joystick|chess|dice|sword|\bshield\b|trophy|steam|xbox|playstation|nintendo|puzzle|cards|poker/,
  media: /music|headphone|microphone|video|camera|film|play|pause|volume|radio|spotify|youtube|image|palette|brush|record/,
  home: /home|house|account|person|user|family|heart|coffee|food|sofa|bed|lamp|cat|dog|face|human/,
  nature: /tree|flower|leaf|sun|moon|cloud|weather|rain|snow|water|fire|mountain|forest|earth|plant|bird|paw/,
  travel: /car|bus|train|plane|airplane|rocket|bike|bicycle|ship|boat|map|compass|globe|luggage|suitcase|beach/,
  shapes: /circle|square|triangle|hexagon|star|diamond|arrow|check|cross|plus|minus|infinity|shape|lightning|sparkle/,
};
const popular = new Set(['Home', 'Briefcase', 'Code2', 'Terminal', 'Gamepad2', 'Music', 'Headphones', 'Camera', 'BookOpen', 'Folder', 'Heart', 'Star', 'Coffee', 'Rocket', 'Globe', 'Layers', 'Monitor', 'Palette', 'Shield', 'Zap', 'nf-dev-github', 'nf-dev-docker', 'nf-fa-steam', 'nf-fa-spotify']);
export const PACK_NAMES: Record<string, string> = { lucide: 'Lucide outlines', md: 'Material Design', fa: 'Font Awesome', dev: 'Developer logos', cod: 'VS Code icons', oct: 'GitHub Octicons', linux: 'Linux logos', weather: 'Weather', seti: 'File types', custom: 'Custom symbols', iec: 'Power symbols', pl: 'Powerline', ple: 'Powerline extras', pom: 'Pomodoro', indent: 'Indentation' };
export type CatalogIcon = { id: string; label: string; text: string; pack: string; categories: string[] };
const normalize = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase().trim();
function entry(id: string, raw: string, pack: string): CatalogIcon {
  const text = normalize(raw);
  const categories = Object.entries(rules).filter(([, rule]) => rule.test(text)).map(([key]) => key);
  if (['dev', 'linux', 'custom', 'seti'].includes(pack) || /github|steam|spotify|youtube|discord|microsoft|apple|google|firefox|chrome|twitch|slack|windows|android/.test(text)) categories.push('brands');
  if (popular.has(id)) categories.push('popular');
  return { id, text, label: text.charAt(0).toUpperCase() + text.slice(1), pack, categories };
}
const seen = new Set<string>();
export const ICON_CATALOG: CatalogIcon[] = [
  ...Object.keys(ICON_MAP).filter(name => /^[A-Z]/.test(name) && !name.startsWith('Lucide') && !name.endsWith('Icon') && name !== 'Icon' && !!ICON_MAP[name]).map(name => entry(name, name, 'lucide')),
  ...Object.entries(glyphs).flatMap(([name, value]) => {
    if (!('char' in value) || !value.char || seen.has(value.char)) return [];
    seen.add(value.char);
    const separator = name.indexOf('-');
    return [entry(`nf-${name}`, name.slice(separator + 1), name.slice(0, separator))];
  }),
].sort((a, b) => a.label.localeCompare(b.label) || a.pack.localeCompare(b.pack));
export const ICON_BY_ID = new Map(ICON_CATALOG.map(icon => [icon.id, icon]));
const synonyms: Record<string, string[]> = {
  gaming: ['game', 'controller', 'joystick', 'steam', 'xbox'], games: ['game', 'controller', 'joystick'],
  work: ['briefcase', 'office', 'clipboard', 'chart'], coding: ['code', 'terminal', 'program', 'git'],
  development: ['code', 'terminal', 'program'], developer: ['code', 'terminal', 'program'],
  audio: ['music', 'headphone', 'volume', 'microphone'], study: ['book', 'school', 'graduat'],
  folder: ['folder', 'directory'], settings: ['settings', 'cog', 'gear'],
  favourite: ['heart', 'star'], favorite: ['heart', 'star'], internet: ['globe', 'web', 'browser', 'wifi'],
};
export function searchIcons(query: string, icons = ICON_CATALOG): CatalogIcon[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return icons;
  const scored = icons.map(icon => {
    const text = `${icon.text} ${PACK_NAMES[icon.pack] || icon.pack}`.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (icon.text === term) score += 20;
      else if (text.split(' ').includes(term)) score += 10;
      else if (text.includes(term)) score += 5;
      else if (synonyms[term]?.some(word => text.includes(word))) score += 1;
      else return { icon, score: -1 };
    }
    return { icon, score };
  });
  return scored.filter(item => item.score >= 0).sort((a, b) => b.score - a.score || a.icon.label.localeCompare(b.icon.label)).map(item => item.icon);
}
