import React, { useMemo, useRef, useState } from 'react';
import { Check, Search, Star, X } from 'lucide-react';
import { getIcon } from '../iconMap';
import type { UIConfig } from '../types';
import { ICON_BY_ID, ICON_CATALOG, ICON_CATEGORIES, PACK_NAMES, searchIcons } from '../utils/iconCatalog';

export interface IconPickerProps {
  selectedIcon: string;
  onSelect: (iconName: string) => void;
  config: UIConfig;
  variant?: 'default' | 'compact';
  className?: string;
}
const PAGE_SIZE = 96;
function loadFavorites(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem('rovyl-favorite-icons') || '[]');
    return Array.isArray(stored) ? stored.filter(id => typeof id === 'string' && ICON_BY_ID.has(id)) : [];
  } catch { return []; }
}

export function IconPicker({ selectedIcon, onSelect, variant = 'default', className = '' }: IconPickerProps) {
  const [category, setCategory] = useState('popular');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [pack, setPack] = useState('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [favorites, setFavorites] = useState(loadFavorites);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selected = ICON_BY_ID.get(selectedIcon);
  const SelectedIcon = getIcon(selectedIcon);
  const packs = useMemo(() => Array.from(new Set(ICON_CATALOG.map(icon => icon.pack))).sort(), []);
  const filtered = useMemo(() => {
    const source = ICON_CATALOG.filter(icon => (pack === 'all' || icon.pack === pack) &&
      (query.trim() || category === 'all' || (category === 'favorites' ? favorites.includes(icon.id) : icon.categories.includes(category))));
    return searchIcons(query, source);
  }, [category, query, pack, favorites]);
  const resetScroll = () => { setLimit(PAGE_SIZE); scrollRef.current?.scrollTo(0, 0); };
  const toggleFavorite = () => {
    const next = favorites.includes(selectedIcon) ? favorites.filter(id => id !== selectedIcon) : [...favorites, selectedIcon];
    setFavorites(next);
    try { localStorage.setItem('rovyl-favorite-icons', JSON.stringify(next)); } catch { /* Session-only if storage is unavailable. */ }
  };
  return <div className={`zs-icon-library ${variant === 'compact' ? 'is-compact' : ''} ${className}`}>
    <div className="zs-icon-library-toolbar"><div><b>Icon library</b><small>{ICON_CATALOG.length.toLocaleString()} icons · available offline</small></div><button type="button" className="zs-btn" aria-expanded={searchOpen} onClick={() => { setSearchOpen(!searchOpen); setQuery(''); resetScroll(); }}><Search size={15} /> Search</button></div>
    {searchOpen && <label className="zs-icon-library-search"><Search size={16} /><input autoFocus aria-label="Search icon library" placeholder="Try gaming, music, coding, or an app name…" value={query} onChange={event => { setQuery(event.target.value); resetScroll(); }} /><button type="button" aria-label="Clear icon search" onClick={() => { setQuery(''); resetScroll(); }}><X size={14} /></button></label>}
    <div className="zs-icon-library-sections" aria-label="Icon categories">{ICON_CATEGORIES.map(([id, label]) => <button type="button" key={id} aria-pressed={!query && category === id} onClick={() => { setCategory(id); setQuery(''); setPack('all'); resetScroll(); }}>{label}</button>)}</div>
    <div className="zs-icon-library-filter"><span role="status">{filtered.length.toLocaleString()} {query ? 'matches across the library' : 'icons in this section'}</span><label>Collection <select aria-label="Icon collection" value={pack} onChange={event => { setPack(event.target.value); setCategory('all'); resetScroll(); }}><option value="all">All collections</option>{packs.map(id => <option key={id} value={id}>{PACK_NAMES[id] || id}</option>)}</select></label></div>
    <div className="zs-icon-library-results" ref={scrollRef} onScroll={event => { const node = event.currentTarget; if (node.scrollHeight - node.scrollTop - node.clientHeight < 160) setLimit(current => Math.min(current + PAGE_SIZE, filtered.length)); }}>
      <div className="zs-icon-library-grid">{filtered.slice(0, limit).map(icon => {
        const Icon = getIcon(icon.id);
        return <button type="button" key={icon.id} aria-label={`${icon.label} — ${PACK_NAMES[icon.pack] || icon.pack}`} aria-pressed={selectedIcon === icon.id} title={`${icon.label} · ${PACK_NAMES[icon.pack] || icon.pack}`} onClick={() => onSelect(icon.id)}><Icon size={26} strokeWidth={1.7} /><span>{icon.label}</span>{selectedIcon === icon.id && <Check className="zs-icon-library-check" size={12} />}</button>;
      })}</div>
      {!filtered.length && <div className="zs-icon-library-empty"><b>{category === 'favorites' && !query ? 'Keep your go-to icons here' : 'No matching icons'}</b><p>{category === 'favorites' && !query ? 'Choose an icon, then use the star below to save it.' : 'Try a shorter name, a different collection, or browse a section.'}</p><button type="button" className="zs-btn" onClick={() => { setQuery(''); setPack('all'); setCategory('all'); resetScroll(); }}>Browse all icons</button></div>}
      {filtered.length > limit && <button type="button" className="zs-btn zs-icon-library-more" onClick={() => setLimit(current => current + PAGE_SIZE)}>Show more icons ({filtered.length - limit} remaining)</button>}
    </div>
    <div className="zs-icon-library-selected"><SelectedIcon size={28} /><div><b>{selected?.label || selectedIcon.replace(/^nf-/, '').replace(/[_-]/g, ' ')}</b><small>Selected · changes save automatically</small></div><button type="button" className="zs-btn" aria-label={favorites.includes(selectedIcon) ? 'Remove icon from favorites' : 'Add icon to favorites'} aria-pressed={favorites.includes(selectedIcon)} onClick={toggleFavorite}><Star size={17} fill={favorites.includes(selectedIcon) ? 'currentColor' : 'none'} /></button></div>
  </div>;
}
