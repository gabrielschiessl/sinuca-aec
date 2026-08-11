# Configuração do login Google

## Google Cloud Console

No cliente OAuth do tipo **Aplicativo da Web**, use:

- Origem JavaScript: `http://localhost:5500`
- Origem JavaScript: `http://127.0.0.1:5500`
- Origem JavaScript: `https://gabrielschiessl.github.io`
- Origem JavaScript: `https://netzup.com.br`

O Google Identity Services usado pelo projeto não exige URI de redirecionamento.

Enquanto a tela de consentimento estiver no modo de teste, adicione como usuários de teste as mesmas contas que terão acesso administrativo.

## Propriedades do Apps Script

Em **Configurações do projeto > Propriedades do script**, crie:

- Propriedade: `ADMIN_EMAILS`
- Valor: lista de e-mails autorizados separados por vírgula

Os e-mails não devem ser incluídos em arquivos públicos do repositório.

## Publicação do Apps Script

1. Sincronize os arquivos da pasta `appsscript` com o projeto Apps Script.
2. Crie uma nova versão da implantação do tipo **App da Web**.
3. Execute como o proprietário do projeto.
4. Permita acesso a qualquer pessoa, pois a autorização administrativa é validada pelo token Google e pela lista privada no servidor.
5. Preserve a URL da implantação usada em `js/api.js` ou atualize-a se o Google gerar outra URL.

Na primeira execução, o Apps Script pedirá autorização para consultar a validação de tokens do Google.

## Sessão

A API retorna um token de sessão opaco, salvo no `localStorage` do dispositivo por até 30 dias. A senha e o token de identidade Google não são persistidos pelo site.
