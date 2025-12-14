import { parseFile } from './parser.js';
import * as path from 'path';

// Тестируем на самом себе - парсим init.ts
const testFile = path.join(process.cwd(), 'src/commands/init.ts');

console.log('Parsing:', testFile);
const result = parseFile(testFile);

console.log('\nResult:');
console.log(JSON.stringify(result, null, 2));
