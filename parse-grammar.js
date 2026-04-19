const fs = require('fs');

const md = fs.readFileSync('/home/lux/TOPIK_Grammar_Levels_1-6.md', 'utf-8');
const lines = md.split('\n');

const grammar = [];
let currentLevel = '';
let currentCategory = '';
let id = 0;

for (const line of lines) {
  const levelMatch = line.match(/^## TOPIK I — Levels 1 & 2/);
  if (levelMatch) {
    currentLevel = '1-2';
    continue;
  }
  const level2Match = line.match(/^## TOPIK II — Levels 3 & 4/);
  if (level2Match) {
    currentLevel = '3-4';
    continue;
  }
  const level3Match = line.match(/^## TOPIK II — Levels 5 & 6/);
  if (level3Match) {
    currentLevel = '5-6';
    continue;
  }

  const catMatch = line.match(/^### ([A-Z]\. .+)$/);
  if (catMatch && currentLevel) {
    currentCategory = catMatch[1].replace(/^[A-Z]\.\s*/, '').trim();
    continue;
  }

  const rowMatch = line.match(/^\|\s*\d+\s*\|\s*\*\*([^*|]+)\*\*\s*\|\s*([^|]+)\s*\|/);
  if (rowMatch && currentLevel && currentCategory) {
    id++;
    grammar.push({
      id,
      level: currentLevel,
      category: currentCategory,
      grammar: rowMatch[1].trim(),
      meaning: rowMatch[2].trim(),
    });
  }
}

fs.writeFileSync(
  '/home/lux/topik-grammar-study/src/data/grammar.json',
  JSON.stringify(grammar, null, 2)
);

console.log(`Parsed ${grammar.length} grammar points`);
