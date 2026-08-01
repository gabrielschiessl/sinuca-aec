const API_URL =
  "https://script.google.com/macros/s/AKfycbxiODKmPWxklKHLZ3MyNhY8EeGYvQa0Jue8CkWOAakuUZEioMZ4KM0OKfq7Jnl5vQrD/exec";

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
