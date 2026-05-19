import { readFileSync } from 'fs';
const text = readFileSync('./eslint-components-output.json', 'utf-8');
const jsonStr = text.split('\n').filter(l => l.startsWith('[{"filePath')).join('');
const data = JSON.parse(jsonStr);
const errors = data.filter(e => e.messages.some(m => m.ruleId === '@typescript-eslint/explicit-function-return-type'));
errors.forEach(e => {
  e.messages.filter(m => m.ruleId === '@typescript-eslint/explicit-function-return-type').forEach(m => {
    // eslint-disable-next-line no-console
    console.log(`${e.filePath}:${m.line}:${m.column} ${m.message}`);
  });
});