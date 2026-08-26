# Login administrativo com Google

## Google Cloud Console

No cliente OAuth do tipo **Aplicativo da Web**, cadastre as origens usadas pelo
projeto:

- `http://localhost:5500`
- `http://127.0.0.1:5500`
- `https://netzup.com.br`

Cadastre também a URI de redirecionamento autorizada usada pelo PWA instalado
no iPhone:

- `https://netzup.com.br/sinuca-aec/api/google-login-redirect.php`

O navegador comum usa o callback JavaScript em modo popup e não depende dessa
URI. No iOS em modo standalone, o sistema usa redirecionamento de página inteira
porque a comunicação entre o popup do Google e a janela do PWA não é confiável.
Enquanto a tela de consentimento estiver em teste, inclua as contas
administrativas como usuários de teste.

## API MySQL (produção)

Configure em `api/config.local.php`:

- `google_client_id`: o mesmo cliente configurado em `js/config.js`;
- `admin_emails`: lista das contas autorizadas;
- `session_duration_seconds`: validade da sessão administrativa.

O arquivo local não deve ser enviado ao Git.

## Apps Script (QAS opcional)

O backend alternativo é selecionado acrescentando `?api=appscript` à URL. Nele,
configure a propriedade de script `ADMIN_EMAILS`, publique como aplicativo da
Web executado pelo proprietário e mantenha sua URL em `js/api.js`. O QAS mantém
o fluxo popup; o endpoint de redirecionamento pertence ao backend PHP/MySQL.
