import { loadYAML } from './utils/yaml-loader.ts';
import { ConfigSchema } from './types/config.ts';

const filePath = process.argv[2] ?? '.featuremap/config.yaml';
const config = loadYAML(filePath, ConfigSchema);
console.log('Config loaded:', config);
