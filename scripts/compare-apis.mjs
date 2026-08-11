const OLD_API = process.env.AEC_OLD_API ||
  "https://script.google.com/macros/s/AKfycbzQEJ5hbg5DjhhYRmakCJuC3DO16uwYP6lP0D5zYhKbuAIe4471Zfs6DiytrL2looie/exec";
const NEW_API = process.env.AEC_NEW_API ||
  "https://netzup.com.br/sinuca-aec/api/";

async function request(baseUrl, action, params = {}) {
  const url = new URL(baseUrl);
  url.search = new URLSearchParams({ acao: action, ...params }).toString();
  const response = await fetch(url, { redirect: "follow" });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  try {
    const data = JSON.parse(text);
    if (data?.erro) throw new Error(`${url}: ${data.erro}`);
    return data;
  } catch (error) {
    if (error.message.startsWith(String(url))) throw error;
    throw new Error(`${url}: resposta não é JSON: ${text.slice(0, 300)}`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["atualizado_em"].includes(key))
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
}

function firstDifference(left, right, path = "$") {
  if (Object.is(left, right)) return null;
  if (typeof left !== typeof right || left === null || right === null) {
    return { path, antigo: left, novo: right };
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return { path, antigo: left, novo: right };
    }
    if (left.length !== right.length) {
      return { path: `${path}.length`, antigo: left.length, novo: right.length };
    }
    for (let index = 0; index < left.length; index += 1) {
      const difference = firstDifference(left[index], right[index], `${path}[${index}]`);
      if (difference) return difference;
    }
    return null;
  }
  if (typeof left === "object") {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      if (!(key in left) || !(key in right)) {
        return { path: `${path}.${key}`, antigo: left[key], novo: right[key] };
      }
      const difference = firstDifference(left[key], right[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return null;
  }
  return { path, antigo: left, novo: right };
}

const seasons = await request(OLD_API, "temporadas");
const tests = [{ action: "temporadas", params: {} }];
for (const season of seasons.temporadas) {
  for (const division of ["A", "B"]) {
    tests.push(
      { action: "rodadas", params: { serie: division, temporada: season } },
      { action: "estatisticas", params: { serie: division, temporada: season } },
    );
  }
}

let failures = 0;
for (const test of tests) {
  const label = `${test.action} ${test.params.temporada || ""} ${test.params.serie || ""}`.trim();
  try {
    const [oldData, newData] = await Promise.all([
      request(OLD_API, test.action, test.params),
      request(NEW_API, test.action, test.params),
    ]);
    const difference = firstDifference(canonicalize(oldData), canonicalize(newData));
    if (difference) {
      failures += 1;
      console.log(`DIFERENTE  ${label}`);
      console.log(`  ${difference.path}`);
      console.log(`  antigo: ${JSON.stringify(difference.antigo)}`);
      console.log(`  novo:   ${JSON.stringify(difference.novo)}`);
    } else {
      console.log(`OK         ${label}`);
    }
  } catch (error) {
    failures += 1;
    console.log(`ERRO       ${label}`);
    console.log(`  ${error.message}`);
  }
}

console.log(`\n${tests.length - failures}/${tests.length} consultas equivalentes.`);
process.exitCode = failures ? 1 : 0;

