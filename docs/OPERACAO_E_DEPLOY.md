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
5. Enviar modelos binários novos/alterados.
6. Não enviar `.git`, `.vscode`, `config.local.php` local, dumps ou temporários.
7. Confirmar `/api/?acao=status`.
8. Abrir Home, Série A, Série B, Regra, Histórico, Ranking e Administrador.
9. Fazer login, mas começar com testes somente leitura.
10. Testar a mutação em escopo controlado e conferir diretamente no MySQL.
11. Validar em desktop e Safari/iPhone.
12. Se houver cache visual antigo, confirmar os headers antes de culpar o banco.

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

## Diagnóstico rápido

| Sintoma | Verificar |
|---|---|
| “Erro ao acessar a API” | Network, JSON, status HTTP, `debug`, logs PHP |
| Alteração foi para Sheets | URL contém `?api=appscript` |
| Login `origin_mismatch` | origem cadastrada no Google Cloud |
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
