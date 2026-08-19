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
