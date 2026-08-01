const API_URL =
  "https://script.google.com/macros/s/AKfycbzQEJ5hbg5DjhhYRmakCJuC3DO16uwYP6lP0D5zYhKbuAIe4471Zfs6DiytrL2looie/exec";

async function request(acao, params = {}) {
  const query = new URLSearchParams({
    acao,

    ...params,
  });

  const response = await fetch(`${API_URL}?${query}`);

  if (!response.ok) {
    throw new Error("Erro ao acessar a API.");
  }

  return response.json();
}

/************************************************
 * Rodadas
 ************************************************/

export async function getRodadas(divisao) {
  return request("rodadas", {
    serie: divisao,
  });
}
