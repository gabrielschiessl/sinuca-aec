# Operação, configuração e publicação

## Ambientes

### Produção

- Base: `https://netzup.com.br/sinuca-aec/`.
- Frontend e API PHP na mesma origem.
- Banco MySQL da hospedagem.
- Backend escolhido automaticamente sem query string.

### QAS alternativo

- Mesmos arquivos estáticos, acrescentando `?api=appscript`.
- Persistência em planilha Google configurada em `appsscript/config.gs`.
- Possui paridade de contrato com as ações consumidas pelo frontend; as
  garantias de persistência diferem das transações MySQL.

## Configuração PHP

Copie `api/config.example.php` para `api/config.local.php` somente no servidor:

```php
return [
    'environment' => 'production',
    'debug' => false,
    'database' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => '...',
        'user' => '...',
        'password' => '...',
        'charset' => 'utf8mb4',
    ],
    'google_client_id' => '...',
    'admin_emails' => ['conta@gmail.com'],
    'session_duration_seconds' => 60 * 60 * 24 * 30,
];
```

Nunca versionar ou enviar credenciais em capturas, logs ou respostas de IA.

## Requisitos PHP

### Publicação da API de salas (etapa 2)

1. Após backup, aplicar 006 se 005 já está instalada.
2. Publicar `api/placar.php`, `api/src/ScoreboardRoomService.php` e
   `api/src/ScoreboardState.php`. Não sobrescrever `config.local.php` com o
   exemplo: acrescentar somente o bloco abaixo ao array existente.
3. Habilitar no `api/config.local.php` do servidor:

```php
'scoreboard_rooms' => [
    'enabled' => true,
    'ttl_seconds' => 86400,
],
```

4. Abrir `/sinuca-aec/api/placar.php?acao=status`. Esperado: `status: online`,
   `salas_habilitadas: true`, `banco: mysql`, `validade_segundos: 86400`.
5. Publicar `js/scoreboardRooms.js`, `js/pages/placar.js`, `css/components.css`
   e `service-worker.js` juntos. Interface de salas não exige nova migração
   além de 005 e 006 já previstas. Testar operações em salas descartáveis,
   seguindo `PLACAR_COMPARTILHADO.md`; não envolve partidas oficiais.

Desativação: `enabled => false` bloqueia somente a API de salas; não altera o
placar local nem a API dos campeonatos. Não enviar `tests/` para a pasta pública.
Não registrar corpos das requisições de salas nos logs da hospedagem, pois eles
podem conter senha ou token. Para códigos de seis dígitos/PIN de quatro,
reenviar também `api/src/ScoreboardRoomService.php` e frontend/cache v24.
Não há SQL novo: o schema 005 + 006 já comporta esse formato.

### Extensões

- PHP 8.3;
- PDO MySQL;
- cURL;
- JSON;
- DOM/XML;
- ZIP.

## Checklist de publicação

1. Fazer backup do banco e dos arquivos atuais.
2. Conferir `git status` e o diff.
3. Aplicar migração necessária primeiro em QAS.
4. Enviar os arquivos alterados preservando a estrutura de `/sinuca-aec`.
5. Em alterações da PWA, enviar também `manifest.webmanifest`,
   `service-worker.js` e todos os arquivos de `assets/icons/`.
6. Enviar modelos binários novos/alterados.
7. Não enviar `.git`, `.vscode`, `config.local.php` local, dumps ou temporários.
8. Confirmar `/api/?acao=status`.
9. Abrir Home, Série A, Série B, Regra, Histórico, Ranking e Administrador.
10. Fazer login, mas começar com testes somente leitura.
11. Testar a mutação em escopo controlado e conferir diretamente no MySQL.
12. Validar em desktop e Safari/iPhone.
13. Se houver cache visual antigo, confirmar os headers antes de culpar o banco.

## Backup e restauração

Antes de operação estrutural ou troca de temporada:

- exportar SQL completo pelo cPanel/phpMyAdmin;
- armazenar fora da pasta pública;
- registrar horário e versão do código;
- validar que o arquivo de backup não está vazio;
- ter um procedimento de restauração conhecido.

Restauração deve ocorrer com o site temporariamente sem escrita administrativa
para evitar misturar dados novos com o snapshot.

## Google OAuth

As origens JavaScript devem incluir localhost usado no desenvolvimento e
`https://netzup.com.br`. O client ID público em `js/config.js` precisa coincidir
com o `google_client_id` do backend. Autorização final depende também da lista
privada `admin_emails`.

Para o login dentro do PWA instalado no iPhone, cadastrar também como URI de
redirecionamento autorizada:

`https://netzup.com.br/sinuca-aec/api/google-login-redirect.php`

O arquivo precisa ser publicado junto da API. Ele aceita somente POST do fluxo
Google, valida o token CSRF, cria a sessão pelo mesmo `AuthService` e retorna ao
Administrador sem expor o token de sessão na URL.

## Apps Script

Ao atualizar QAS:

1. sincronizar apenas os `.gs` atuais;
2. configurar `ADMIN_EMAILS` nas propriedades do script;
3. revisar `SPREADSHEET_ID` e `GOOGLE_CLIENT_ID`;
4. confirmar que `REGULATION_TEMPLATE_URL` está acessível ou preencher
   `REGULATION_TEMPLATE_FILE_ID` com uma cópia isolada no Drive;
5. criar nova versão da implantação Web App;
6. atualizar a URL em `js/api.js` se ela mudar;
7. testar sempre com `?api=appscript` visível na URL.

## Cache

`.htaccess` força `no-cache` para HTML, CSS, JS e MJS. Assets pesados têm cache
de 30 dias. Ao substituir uma imagem mantendo o mesmo nome, o navegador pode
preservá-la; prefira nome versionado ou ajuste controlado de cache.

O service worker da PWA usa rede primeiro e não controla `api/`. Ao publicar
uma alteração nele, recarregue o site e confirme em DevTools > Application que
o novo worker assumiu o controle. Se o nome do cache for alterado, a ativação
remove automaticamente caches antigos com prefixo `aec-sinuca-`.

## Instalação da PWA

- Android/Chrome: depois de atender aos critérios do navegador, a opção nativa
  “Instalar app” aparece no menu ou na interface do navegador.
- iPhone/iPad: usar o menu de compartilhamento e “Adicionar à Tela de Início”.
- Desktop compatível: usar o ícone/opção de instalação do navegador.

Não existe modal ou botão de instalação no frontend. Para trocar a identidade
visual, substituir mantendo nome e dimensão: `pwa-192.png`, `pwa-512.png`,
`pwa-maskable-192.png`, `pwa-maskable-512.png` e `apple-touch-icon.png`. Os
ícones maskable devem manter a arte principal dentro da área segura central.

## Diagnóstico rápido

| Sintoma | Verificar |
|---|---|
| “Erro ao acessar a API” | Network, JSON, status HTTP, `debug`, logs PHP |
| Alteração foi para Sheets | URL contém `?api=appscript` |
| Login `origin_mismatch` | origem cadastrada no Google Cloud |
| Login `redirect_uri_mismatch` no PWA | URI exata de `google-login-redirect.php` cadastrada no Google Cloud |
| PWA volta do Google sem autenticar | endpoint publicado, resposta POST nos logs e storage permitido no iPhone |
| Conta sem acesso | `admin_emails` e e-mail autenticado |
| DOCX não gera | modelo, extensões ZIP/DOM, taxa e datas |
| XLSX não gera | CDN ExcelJS, imagens e dataset da API |
| Página direta dá 404 | pasta da rota, `404.html`, base path |
| Interface antiga | headers, cache de asset e arquivo realmente publicado |
| Histórico vazio | status da temporada e existência da divisão |

## Segurança

- Manter `debug=false` em produção.
- Usar usuário MySQL exclusivo e com privilégios mínimos necessários.
- Não confiar em controles desabilitados do frontend; validar tudo no backend.
- Revogar sessões após perda de dispositivo ou remoção de administrador.
- Monitorar `audit_log` em alterações sensíveis.
- Não colocar backups dentro de `public_html`.
