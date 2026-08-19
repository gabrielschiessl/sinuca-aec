# Login administrativo com Google

## Google Cloud Console

No cliente OAuth do tipo **Aplicativo da Web**, cadastre as origens usadas pelo
projeto:

- `http://localhost:5500`
- `http://127.0.0.1:5500`
- `https://netzup.com.br`

O Google Identity Services usado pelo sistema não exige URI de redirecionamento.
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
Web executado pelo proprietário e mantenha sua URL em `js/api.js`.
