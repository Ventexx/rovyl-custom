import type { UIConfig } from './types';

export type Language = UIConfig['language'];

// Only labels used by the current radial and icon picker are retained.
const translations: Record<Language, Record<string, string>> = {
  "pt": {
    "iconPicker.search_placeholder": "Buscar ícone…",
    "iconPicker.no_results": "Nenhum ícone encontrado.",
    "iconPicker.english_keywords_hint": "Dica: palavras em inglês (work, time, home…) também mostram ícones relacionados pelo significado.",
    "menu.back": "Voltar",
    "menu.center": "Centro",
    "menu.recents_fallback": "Abrir app (sem pastas recentes detectadas)"
  },
  "en": {
    "iconPicker.search_placeholder": "Search icons…",
    "iconPicker.no_results": "No icons found.",
    "iconPicker.english_keywords_hint": "Tip: English words (work, time, home…) also surface related icons by meaning, not only by name.",
    "menu.back": "Back",
    "menu.center": "Center",
    "menu.recents_fallback": "Open app (no recent folders found)"
  },
  "es": {
    "iconPicker.search_placeholder": "Buscar icono…",
    "iconPicker.no_results": "No se encontraron iconos.",
    "iconPicker.english_keywords_hint": "Consejo: las palabras en inglés (work, time, home…) muestran iconos relacionados por significado."
  },
  "fr": {
    "iconPicker.search_placeholder": "Rechercher une icône…",
    "iconPicker.no_results": "Aucune icône trouvée.",
    "iconPicker.english_keywords_hint": "Astuce : des mots anglais (work, time, home…) affichent aussi des icônes liées par le sens.",
    "menu.back": "Retour",
    "menu.center": "Centre"
  },
  "de": {
    "iconPicker.search_placeholder": "Symbole suchen…",
    "iconPicker.no_results": "Keine Symbole gefunden.",
    "iconPicker.english_keywords_hint": "Tipp: Englische Begriffe (work, time, home…) zeigen auch passende Symbole nach Bedeutung.",
    "menu.back": "Zurück",
    "menu.center": "Zentrum"
  },
  "it": {
    "iconPicker.search_placeholder": "Cerca icona…",
    "iconPicker.no_results": "Nessuna icona trovata.",
    "iconPicker.english_keywords_hint": "Suggerimento: parole inglesi (work, time, home…) mostrano anche icone correlate per significato.",
    "menu.back": "Indietro",
    "menu.center": "Centro"
  },
  "ja": {
    "iconPicker.search_placeholder": "アイコンを検索…",
    "iconPicker.no_results": "該当するアイコンがありません。",
    "iconPicker.english_keywords_hint": "ヒント: 英語の単語（work、time、home など）でも、名前以外の関連アイコンが表示されます。",
    "menu.back": "戻る",
    "menu.center": "中央"
  },
  "zh": {
    "iconPicker.search_placeholder": "搜索图标…",
    "iconPicker.no_results": "未找到图标。",
    "iconPicker.english_keywords_hint": "提示：输入英文词（如 work、time、home）也可按含义显示相关图标，不限于图标名称。",
    "menu.back": "返回",
    "menu.center": "中心"
  },
  "ko": {
    "iconPicker.search_placeholder": "아이콘 검색…",
    "iconPicker.no_results": "아이콘을 찾을 수 없습니다.",
    "iconPicker.english_keywords_hint": "팁: 영어 단어(work, time, home 등)로 이름과 무관하게 관련 아이콘을 찾을 수 있습니다.",
    "menu.back": "뒤로",
    "menu.center": "중앙"
  },
  "ru": {
    "iconPicker.search_placeholder": "Поиск значков…",
    "iconPicker.no_results": "Значки не найдены.",
    "iconPicker.english_keywords_hint": "Подсказка: английские слова (work, time, home…) показывают связанные значки по смыслу.",
    "menu.back": "Назад",
    "menu.center": "Центр"
  }
};

export const getTranslation = (config: UIConfig, key: string): string => {
  const lang = config.language || 'pt';
  return translations[lang]?.[key] || translations.en[key] || key;
};
