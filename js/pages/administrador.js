import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import {
  authenticateWithGoogle,
  endAdminSession,
  restoreAdminSession,
} from "../auth.js";
import { GOOGLE_CLIENT_ID } from "../config.js";

const PAGE_ID = "admin-page";

export function renderAdministrador() {
  const app = document.getElementById("app");

  app.innerHTML = `
    ${renderNavbar({ title: "Administrador" })}
    <main class="admin-layout">
      <div class="admin-page" id="${PAGE_ID}">
        <section class="admin-card">
          <div class="loading-state" role="status">
            <div class="loading-spinner" aria-hidden="true"></div>
            <p>Verificando sua sessão...</p>
          </div>
        </section>
      </div>
      ${renderFooter("footer-light admin-footer")}
    </main>
  `;

  initializeAdminPage();
}

async function initializeAdminPage() {
  try {
    const session = await restoreAdminSession();

    if (!isCurrentPage()) return;

    if (session) {
      renderDashboard(session);
      return;
    }
  } catch (error) {
    if (!isCurrentPage()) return;
    renderLogin(getFriendlyAuthError(error));
    return;
  }

  renderLogin();
}

function renderLogin(message = "") {
  const page = getPage();
  if (!page) return;

  page.innerHTML = `
    <section class="admin-card admin-login-card">
      <i class="bi bi-shield-lock admin-card-icon" aria-hidden="true"></i>
      <h1>Área administrativa</h1>
      <p>Entre com uma conta Google autorizada para administrar o campeonato.</p>
      ${message ? `<p class="admin-message error-state-inline">${escapeHtml(message)}</p>` : ""}
      <div id="google-signin-button" class="google-signin-button"></div>
      <p class="admin-privacy-note">Sua senha não é compartilhada com o Sistema AEC Sinuca.</p>
    </section>
  `;

  mountGoogleButton();
}

async function mountGoogleButton() {
  const button = document.getElementById("google-signin-button");
  if (!button) return;

  try {
    const googleAccounts = await waitForGoogleIdentity();
    if (!document.body.contains(button)) return;

    googleAccounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    googleAccounts.id.renderButton(button, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: Math.min(320, Math.max(220, button.clientWidth || 320)),
      locale: "pt-BR",
    });
  } catch (error) {
    button.innerHTML = `<button class="btn" type="button" data-admin-retry>Carregar login do Google</button>`;
    button.querySelector("[data-admin-retry]")?.addEventListener("click", mountGoogleButton);
  }
}

function waitForGoogleIdentity(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve(window.google.accounts);
      } else if (Date.now() - startedAt >= timeout) {
        window.clearInterval(timer);
        reject(new Error("O login do Google não carregou."));
      }
    }, 100);
  });
}

async function handleGoogleCredential(response) {
  const page = getPage();
  if (!page || !response?.credential) return;

  page.innerHTML = `
    <section class="admin-card">
      <div class="loading-state" role="status">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p>Validando sua conta...</p>
      </div>
    </section>
  `;

  try {
    const session = await authenticateWithGoogle(response.credential);
    if (isCurrentPage()) renderDashboard(session);
  } catch (error) {
    if (isCurrentPage()) renderLogin(getFriendlyAuthError(error));
  }
}

function renderDashboard(session) {
  const page = getPage();
  if (!page) return;

  const admin = session.administrador || {};

  page.innerHTML = `
    <section class="admin-card admin-dashboard" data-admin-dashboard>
      <div class="admin-profile">
        ${
          admin.foto
            ? `<img src="${escapeHtml(admin.foto)}" alt="" referrerpolicy="no-referrer">`
            : '<i class="bi bi-person-circle" aria-hidden="true"></i>'
        }
        <div>
          <span>Conta administrativa</span>
          <strong>${escapeHtml(admin.nome || admin.email || "Administrador")}</strong>
          <small>${escapeHtml(admin.email || "")}</small>
        </div>
      </div>

      <div class="admin-mode-banner" data-admin-mode-banner>
        <i class="bi bi-eye" aria-hidden="true"></i>
        <div>
          <strong>Modo visualização</strong>
          <span>Nenhuma alteração pode ser feita enquanto este modo estiver ativo.</span>
        </div>
      </div>

      <h1>Gestão do campeonato</h1>
      <p class="admin-intro">Este é o ponto de entrada para jogadores, temporadas, chaveamento e resultados. Os módulos de edição serão ligados aqui nas próximas etapas.</p>

      <div class="admin-actions">
        <button class="btn" type="button" data-enable-edit>
          <i class="bi bi-pencil-square" aria-hidden="true"></i>
          Ativar edição
        </button>
        <button class="btn btn-admin-secondary" type="button" data-admin-logout>Sair</button>
      </div>
    </section>
  `;

  page.querySelector("[data-enable-edit]")?.addEventListener("click", enableEditMode);
  page.querySelector("[data-admin-logout]")?.addEventListener("click", handleLogout);
}

function enableEditMode(event) {
  const dashboard = event.currentTarget.closest("[data-admin-dashboard]");
  const banner = dashboard?.querySelector("[data-admin-mode-banner]");
  if (!dashboard || !banner) return;

  dashboard.classList.add("is-editing");
  banner.innerHTML = `
    <i class="bi bi-pencil-square" aria-hidden="true"></i>
    <div>
      <strong>Modo de edição ativo</strong>
      <span>As futuras ferramentas administrativas serão habilitadas neste modo.</span>
    </div>
  `;
  event.currentTarget.disabled = true;
  event.currentTarget.textContent = "Edição ativada";
}

async function handleLogout(event) {
  event.currentTarget.disabled = true;

  try {
    await endAdminSession();
  } catch (error) {
    // A sessão local já foi removida; o usuário pode sair mesmo se a API estiver indisponível.
  }

  if (isCurrentPage()) renderLogin();
}

function getPage() {
  return document.getElementById(PAGE_ID);
}

function isCurrentPage() {
  return Boolean(getPage());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFriendlyAuthError(error) {
  const message = String(error?.message || "");

  if (
    message.includes("UrlFetchApp") ||
    message.includes("script.external_request")
  ) {
    return "O servidor ainda precisa da autorização do proprietário para validar contas Google. Execute a autorização no Apps Script e tente novamente.";
  }

  return message || "Não foi possível validar a conta. Tente novamente.";
}
