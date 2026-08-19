/************************************************
 * PROJETO AEC SINUCA
 * Configurações
 ************************************************/

const SPREADSHEET_ID = "1ZinnOI2Iijlap7rQBxnXGDkfeGnilL51RoAHiPNKQ2E";

const API_VERSION = "2.1.0-qas";

// O QAS usa o modelo público de produção por padrão. Opcionalmente, informe o
// ID de uma cópia no Drive para testar um modelo isolado da produção.
const REGULATION_TEMPLATE_FILE_ID = "";
const REGULATION_TEMPLATE_URL =
  "https://netzup.com.br/sinuca-aec/api/templates/regulamento-aec.docx";

const GOOGLE_CLIENT_ID =
  "242727081932-ep06g0j80nti9593b2jv456b27llbgjp.apps.googleusercontent.com";

const ADMIN_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

const SHEETS = {

  configuracao: "Configuração",

  jogadores: "Jogadores",

  participantes: "Participantes",

  rodadas: "Rodadas",

  temporadas: "Temporadas",

  temporadasParticipantes: "Temporadas Participantes",

  temporadasRodadas: "Temporadas Rodadas"

};
