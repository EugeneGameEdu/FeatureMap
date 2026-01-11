export function parseJsonWithComments(content: string): unknown {
  const withoutComments = stripJsonComments(content);
  const cleaned = stripTrailingCommas(withoutComments);
  return JSON.parse(cleaned);
}

function stripJsonComments(value: string): string {
  let result = '';
  let inString = false;
  let escape = false;
  let stringChar = '';

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    const next = value[i + 1];

    if (inString) {
      result += char;
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      stringChar = char;
      result += char;
      continue;
    }

    if (char === '/' && next === '/') {
      i += 1;
      while (i + 1 < value.length && value[i + 1] !== '\n') {
        i += 1;
      }
      continue;
    }

    if (char === '/' && next === '*') {
      i += 1;
      while (i + 1 < value.length) {
        if (value[i] === '*' && value[i + 1] === '/') {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    result += char;
  }

  return result;
}

function stripTrailingCommas(value: string): string {
  let result = '';
  let inString = false;
  let escape = false;
  let stringChar = '';

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];

    if (inString) {
      result += char;
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      inString = true;
      stringChar = char;
      result += char;
      continue;
    }

    if (char === ',') {
      let j = i + 1;
      while (j < value.length && /\s/.test(value[j])) {
        j += 1;
      }
      if (value[j] === '}' || value[j] === ']') {
        continue;
      }
    }

    result += char;
  }

  return result;
}
