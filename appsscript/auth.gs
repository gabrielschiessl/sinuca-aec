/************************************************
 * PROJETO AEC SINUCA
 * Autenticação administrativa
 ************************************************/

function loginComGoogle(credential) {
  if (!credential) {
    throw new Error("Credencial Google não informada.");
  }

  const identidade = validarGoogleIdToken(credential);

  if (!getAdminEmails().includes(identidade.email)) {
    throw new Error(
      `A conta autenticada (${identidade.email}) não possui acesso administrativo.`,
    );
  }

  const token = Utilities.getUuid() + Utilities.getUuid();
  const agora = Date.now();
  const sessao = {
    sub: identidade.sub,
    email: identidade.email,
    nome: identidade.name || identidade.email,
    foto: identidade.picture || "",
    criado_em: agora,
    ultimo_uso: agora,
    expira_em: agora + ADMIN_SESSION_DURATION_SECONDS * 1000,
  };

  PropertiesService.getScriptProperties().setProperty(
    getSessionPropertyKey(token),
    JSON.stringify(sessao),
  );

  return {
    autenticado: true,
    token,
    administrador: getAdminPublicData(sessao),
    expira_em: sessao.expira_em,
  };
}

/**
 * Execute esta função uma vez pelo editor do Apps Script para autorizar
 * a consulta ao serviço de validação de tokens do Google.
 */
function autorizarIntegracaoGoogle() {
  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo", {
    muteHttpExceptions: true,
  });

  return `Serviço autorizado. Resposta de teste: ${response.getResponseCode()}`;
}

function validarGoogleIdToken(credential) {
  const response = UrlFetchApp.fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    { muteHttpExceptions: true },
  );

  if (response.getResponseCode() !== 200) {
    throw new Error("Não foi possível validar a conta Google.");
  }

  const identidade = JSON.parse(response.getContentText());
  const expiracao = Number(identidade.exp) * 1000;
  const emissoresGoogle = ["accounts.google.com", "https://accounts.google.com"];

  if (!emissoresGoogle.includes(identidade.iss)) {
    throw new Error("Credencial emitida por um provedor não autorizado.");
  }

  if (identidade.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Credencial destinada a outro aplicativo.");
  }

  if (String(identidade.email_verified) !== "true") {
    throw new Error("O e-mail da conta Google não foi verificado.");
  }

  if (!identidade.sub || !identidade.email || expiracao <= Date.now()) {
    throw new Error("Credencial Google inválida ou expirada.");
  }

  return {
    sub: identidade.sub,
    email: String(identidade.email).trim().toLowerCase(),
    name: identidade.name,
    picture: identidade.picture,
  };
}

function validarSessaoAdmin(token) {
  const sessao = getSessaoAdmin(token);

  sessao.ultimo_uso = Date.now();

  PropertiesService.getScriptProperties().setProperty(
    getSessionPropertyKey(token),
    JSON.stringify(sessao),
  );

  return {
    autenticado: true,
    administrador: getAdminPublicData(sessao),
    expira_em: sessao.expira_em,
  };
}

function getSessaoAdmin(token) {
  if (!token) {
    throw new Error("Sessão administrativa não informada.");
  }

  const properties = PropertiesService.getScriptProperties();
  const key = getSessionPropertyKey(token);
  const value = properties.getProperty(key);

  if (!value) {
    throw new Error("Sessão inválida ou encerrada.");
  }

  const sessao = JSON.parse(value);

  if (Number(sessao.expira_em) <= Date.now()) {
    properties.deleteProperty(key);
    throw new Error("A sessão expirou. Entre novamente.");
  }

  if (!getAdminEmails().includes(String(sessao.email).toLowerCase())) {
    properties.deleteProperty(key);
    throw new Error("A conta não possui mais acesso administrativo.");
  }

  return sessao;
}

function encerrarSessaoAdmin(token) {
  if (!token) return;

  PropertiesService.getScriptProperties().deleteProperty(
    getSessionPropertyKey(token),
  );
}

function getAdminEmails() {
  const value =
    PropertiesService.getScriptProperties().getProperty("ADMIN_EMAILS") || "";

  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function getSessionPropertyKey(token) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    token,
    Utilities.Charset.UTF_8,
  );
  const hash = digest
    .map((byte) => (`0${(byte + 256).toString(16)}`).slice(-2))
    .join("");

  return `ADMIN_SESSION_${hash}`;
}

function getAdminPublicData(sessao) {
  return {
    email: sessao.email,
    nome: sessao.nome,
    foto: sessao.foto,
  };
}
