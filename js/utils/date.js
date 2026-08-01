/************************************************
 * Formata uma data
 ************************************************/

export function formatDate(value) {
  return value || "";
}

/************************************************
 * Formata uma hora
 ************************************************/

export function formatTime(value) {
  if (!value) return "";

  return value.split(":").slice(0, 2).join(":");
}

/************************************************
 * Formata data e hora
 ************************************************/

export function formatDateTime(data, hora) {
  const textoData = formatDate(data);
  const textoHora = formatTime(hora);

  if (!textoData) return textoHora;
  if (!textoHora) return textoData;

  return `${textoData} • ${textoHora}`;
}
