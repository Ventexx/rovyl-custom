const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/iconCatalog.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const catalog = {};
new Function('require', 'exports', output)(name => name === '../iconMap' ? { ICON_MAP: require('lucide-react') } : require('../src/data/nerd-glyphs.json'), catalog);

test('bundled catalog includes thousands of unique offline symbols and existing icons', () => {
  assert.ok(catalog.ICON_CATALOG.length > 10000);
  assert.ok(catalog.ICON_BY_ID.has('Home'));
  assert.equal(catalog.ICON_BY_ID.size, catalog.ICON_CATALOG.length);
  assert.ok(catalog.searchIcons('steam').some(icon => icon.id.startsWith('nf-')));
});
test('search handles spaces, separators, synonyms and all words in a query', () => {
  assert.ok(catalog.searchIcons('gaming').some(icon => /game|controller|joystick/.test(icon.text)));
  assert.ok(catalog.searchIcons('arrow left').length > 10);
  assert.ok(catalog.searchIcons('arrow left').every(icon => icon.text.includes('arrow') && icon.text.includes('left')));
  assert.deepEqual(catalog.searchIcons('arrow_left').map(icon => icon.id), catalog.searchIcons('arrow left').map(icon => icon.id));
  assert.equal(catalog.searchIcons('zzzznotanicon').length, 0);
});
test('sections cover useful domains without treating windshields as gaming shields', () => {
  assert.ok(catalog.ICON_CATALOG.filter(icon => icon.categories.includes('popular')).length >= 20);
  assert.ok(!catalog.ICON_CATALOG.some(icon => icon.text.includes('windshield') && icon.categories.includes('games')));
});
