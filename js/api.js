const API_URL =
  "https://script.google.com/macros/s/AKfycbzQEJ5hbg5DjhhYRmakCJuC3DO16uwYP6lP0D5zYhKbuAIe4471Zfs6DiytrL2looie/exec";

const CACHE_TTL = 60_000;
const cache = new Map();

async function request(acao, params = {}) {
  const query = new URLSearchParams({
    acao,

    ...params,
  });

  const response = await fetch(`${API_URL}?${query}`);

  if (!response.ok) {
    throw new Error("Erro ao acessar a API.");
  }

  const data = await response.json();

  if (data?.erro) {
    throw new Error(data.erro);
  }

  return data;
}

async function post(data) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Erro ao acessar a API.");
  }

  const result = await response.json();

  if (result?.erro) {
    throw new Error(result.erro);
  }

  return result;
}

async function requestCached(key, requestData) {
  const cached = cache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = requestData()
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() });
      return data;
    })
    .catch((error) => {
      cache.delete(key);
      throw error;
    });

  cache.set(key, { promise });

  return promise;
}

/************************************************
 * Rodadas
 ************************************************/

export async function getRodadas(divisao) {
  return requestCached(`rodadas:${divisao}`, () =>
    request("rodadas", {
      serie: divisao,
    }),
  );
}

/************************************************
 * Estatísticas
 ************************************************/

export async function getEstatisticas(divisao) {
  return requestCached(`estatisticas:${divisao}`, () =>
    request("estatisticas", {
      serie: divisao,
    }),
  );
}

/************************************************
 * Administração
 ************************************************/

export function loginGoogle(credential) {
  return post({ acao: "login_google", credential });
}

export function validateAdminSession(token) {
  return post({ acao: "validar_sessao", token });
}

export function logoutAdmin(token) {
  return post({ acao: "logout", token });
}
