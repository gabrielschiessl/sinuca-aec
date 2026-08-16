const APPS_SCRIPT_QAS_API_URL =
  "https://script.google.com/macros/s/AKfycbzQEJ5hbg5DjhhYRmakCJuC3DO16uwYP6lP0D5zYhKbuAIe4471Zfs6DiytrL2looie/exec";
  // "https://script.google.com/macros/s/AKfycbwrXgGHzNFPg8dkRSohBQ_zzuY_fm1PAjChEWtQZLcvTGjHg2fdEljBNaO_a746Df4i/exec";
const MYSQL_API_URL = new URL("../api/", import.meta.url).href;
const requestedApi = new URLSearchParams(window.location.search)
  .get("api")
  ?.trim()
  .toLowerCase();
const API_BACKEND = ["appscript", "apps-script"].includes(requestedApi)
  ? "appscript"
  : "mysql";
const API_URL = API_BACKEND === "appscript"
  ? APPS_SCRIPT_QAS_API_URL
  : MYSQL_API_URL;


const CACHE_TTL = 60_000;
const cache = new Map();

async function request(acao, params = {}) {
  const query = new URLSearchParams({
    acao,

    ...params,
  });

  const response = await fetch(`${API_URL}?${query}`);
  const data = await response.json().catch(() => null);

  if (data?.erro) {
    throw new Error(data.erro);
  }
  if (!response.ok || !data) {
    throw new Error("Erro ao acessar a API.");
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
  const result = await response.json().catch(() => null);

  if (result?.erro) {
    throw new Error(result.erro);
  }
  if (!response.ok || !result) {
    throw new Error("Erro ao acessar a API.");
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

export async function getRodadas(divisao, temporada = "") {
  return requestCached(`rodadas:${divisao}:${temporada}`, () =>
    request("rodadas", {
      serie: divisao,
      ...(temporada ? { temporada } : {}),
    }),
  );
}

/************************************************
 * Estatísticas
 ************************************************/

export async function getEstatisticas(divisao, temporada = "") {
  return requestCached(`estatisticas:${divisao}:${temporada}`, () =>
    request("estatisticas", {
      serie: divisao,
      ...(temporada ? { temporada } : {}),
    }),
  );
}

export async function getTemporadas() {
  return requestCached("temporadas", () => request("temporadas"));
}

export async function getRanking() {
  return requestCached("ranking", () => request("ranking"));
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

export function getAdminPartidas(token, divisao) {
  return post({ acao: "admin_partidas", token, divisao });
}

export function getAdminParticipantes(token, divisao) {
  return post({ acao: "admin_participantes", token, divisao });
}

export function getAdminJogadores(token) {
  return post({ acao: "admin_jogadores", token });
}

export function getAdminTemporadas(token) {
  return post({ acao: "admin_temporadas", token });
}

export function getAdminDadosPlanilha(token, temporada, divisao) {
  return post({ acao: "admin_dados_planilha", token, temporada, divisao });
}

export function saveAdminTaxaInscricao(token, temporada, taxa) {
  return post({ acao: "salvar_taxa_inscricao", token, temporada, taxa }).then((result) => {
    cache.clear();
    return result;
  });
}

export function saveAdminRankingReference(token, temporada) {
  return post({ acao: "salvar_referencia_ranking", token, temporada }).then((result) => {
    cache.clear();
    return result;
  });
}

export function prepareAdminTemporada(token, temporada) {
  return post({ acao: "preparar_temporada", token, temporada });
}

export function prepareAdminTemporadaLegada(token, temporada) {
  return post({ acao: "preparar_temporada_legada", token, temporada });
}

export function getAdminTemporada(token, temporada) {
  return post({ acao: "carregar_temporada", token, temporada });
}

export function saveAdminParticipantes(token, divisao, participantes, ativarJogadores = []) {
  return post({
    acao: "salvar_participantes",
    token,
    divisao,
    participantes,
    ativar_jogadores: ativarJogadores,
  }).then((result) => {
    cache.clear();
    return result;
  });
}

export function saveAdminJogadores(token, jogadores) {
  return post({ acao: "salvar_jogadores", token, jogadores }).then((result) => {
    cache.clear();
    return result;
  });
}

export function saveAdminTemporada(token, temporada, participantes, rodadas) {
  return post({ acao: "salvar_temporada", token, temporada, participantes, rodadas }).then((result) => {
    cache.clear();
    return result;
  });
}

export function saveAdminTemporadaAtual(token, participantes, rodadas) {
  return post({ acao: "salvar_temporada_atual", token, participantes, rodadas }).then((result) => {
    cache.clear();
    return result;
  });
}

export function saveAdminTemporadaLegada(token, temporada, participantes, rodadas) {
  return post({ acao: "salvar_temporada_legada", token, temporada, participantes, rodadas }).then((result) => {
    cache.clear();
    return result;
  });
}

export function publishAdminTemporadaLegada(token, temporada) {
  return post({ acao: "publicar_temporada_legada", token, temporada }).then((result) => {
    cache.clear();
    return result;
  });
}

export function deleteAdminTemporada(token, temporada) {
  return post({ acao: "excluir_temporada", token, temporada }).then((result) => {
    cache.clear();
    return result;
  });
}

export function activateAdminTemporada(token, temporada) {
  return post({ acao: "ativar_temporada", token, temporada }).then((result) => {
    cache.clear();
    return result;
  });
}

export function saveAdminPartida(token, partida) {
  return post({ acao: "salvar_partida", token, ...partida }).then((result) => {
    cache.clear();
    return result;
  });
}

export function saveAdminPartidas(token, partidas) {
  return post({ acao: "salvar_partidas", token, partidas })
    .catch(async (error) => {
      if (!/ação inválida/i.test(error.message)) throw error;

      const resultados = [];
      for (const partida of partidas) {
        const result = await post({ acao: "salvar_partida", token, ...partida });
        resultados.push({
          divisao: partida.divisao,
          rodada: Number(partida.rodada),
          numero1: Number(partida.numero1),
          numero2: Number(partida.numero2),
          ...result,
        });
      }
      return { sucesso: true, partidas: resultados, compatibilidade: true };
    })
    .then((result) => {
      cache.clear();
      return result;
    });
}

export function saveAdminRoundDate(token, divisao, rodada, data) {
  return post({ acao: "salvar_data_rodada", token, divisao, rodada, data }).then((result) => {
    cache.clear();
    return result;
  });
}

export function saveAdminRoundDates(token, rodadas) {
  return post({ acao: "salvar_datas_rodadas", token, rodadas }).then((result) => {
    cache.clear();
    return result;
  });
}
