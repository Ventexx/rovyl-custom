import * as icons from "lucide-react";
import { LucideIcon } from "lucide-react";
import React from 'react';
import glyphs from './data/nerd-glyphs.json';

// Filter out non-component exports if any (defensive coding)
// We cast to any to allow dynamic access by string name
export const ICON_MAP = icons as unknown as Record<string, LucideIcon>;

const nerdComponents = new Map<string, LucideIcon>();
export const getIcon = (name: string): LucideIcon => {
  if (name?.startsWith('nf-')) {
    const glyph = (glyphs as Record<string, { char?: string }>)[name.slice(3)]?.char;
    if (glyph) {
      if (!nerdComponents.has(name)) {
        const component = React.forwardRef<SVGSVGElement, React.ComponentProps<LucideIcon>>(
          ({ size = 24, strokeWidth: _strokeWidth, absoluteStrokeWidth: _absolute, ...props }, ref) =>
            React.createElement('svg', { ...props, ref, width: size, height: size, viewBox: '0 0 32 32', fill: 'currentColor', 'aria-hidden': true },
              React.createElement('text', { x: 16, y: 16, textAnchor: 'middle', dominantBaseline: 'central', style: { fontFamily: 'Rovyl Nerd Symbols', fontSize: 26, fontWeight: 400 } }, glyph)),
        );
        component.displayName = name;
        nerdComponents.set(name, component as LucideIcon);
      }
      return nerdComponents.get(name)!;
    }
  }
  // Return the icon if found, otherwise fallback to Box
  return ICON_MAP[name] || ICON_MAP.Box;
};
