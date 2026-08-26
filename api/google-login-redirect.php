<?php

declare(strict_types=1);

use AecSinuca\ApiException;
use AecSinuca\AuthService;
use AecSinuca\Database;

require_once __DIR__ . '/src/ApiException.php';
require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/GoogleTokenVerifier.php';
require_once __DIR__ . '/src/AuthService.php';

const SESSION_STORAGE_KEY = 'aec_admin_session';
const AUTH_ERROR_STORAGE_KEY = 'aec_admin_redirect_error';

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('Content-Type: text/html; charset=utf-8');

$scriptPath = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
$appPath = rtrim(dirname(dirname($scriptPath)), '/');
$adminPath = ($appPath === '' ? '' : $appPath) . '/administrador';
$configPath = getenv('AEC_SINUCA_CONFIG') ?: __DIR__ . '/config.local.php';

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        throw new ApiException('Retorno de autenticação inválido.', 405);
    }

    $cookieToken = (string) ($_COOKIE['g_csrf_token'] ?? '');
    $bodyToken = (string) ($_POST['g_csrf_token'] ?? '');
    if ($cookieToken === '' || $bodyToken === '' || !hash_equals($cookieToken, $bodyToken)) {
        throw new ApiException('Não foi possível validar o retorno do Google.', 400);
    }
    if (!is_file($configPath)) {
        throw new ApiException('A API ainda não foi configurada.', 503);
    }

    $config = require $configPath;
    $database = Database::connect($config['database']);
    $auth = new AuthService(
        $database,
        (string) ($config['google_client_id'] ?? ''),
        (array) ($config['admin_emails'] ?? []),
        (int) ($config['session_duration_seconds'] ?? 2592000),
    );
    $session = $auth->loginGoogle((string) ($_POST['credential'] ?? ''));
    renderRedirect($adminPath, $session, null);
} catch (Throwable $error) {
    $message = $error instanceof ApiException
        ? $error->getMessage()
        : 'Erro inesperado ao concluir o login.';
    renderRedirect($adminPath, null, $message);
}

function renderRedirect(string $destination, ?array $session, ?string $error): never
{
    $nonce = base64_encode(random_bytes(18));
    header("Content-Security-Policy: default-src 'none'; script-src 'nonce-{$nonce}'; base-uri 'none'; frame-ancestors 'none'");
    $destinationJson = json_encode($destination, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
    $sessionJson = json_encode($session, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
    $errorJson = json_encode($error, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_THROW_ON_ERROR);
    $sessionKeyJson = json_encode(SESSION_STORAGE_KEY, JSON_THROW_ON_ERROR);
    $errorKeyJson = json_encode(AUTH_ERROR_STORAGE_KEY, JSON_THROW_ON_ERROR);

    echo <<<HTML
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Concluindo login</title></head>
<body>
<script nonce="{$nonce}">
try {
  const session = {$sessionJson};
  const error = {$errorJson};
  if (session) {
    localStorage.setItem({$sessionKeyJson}, JSON.stringify(session));
    sessionStorage.removeItem({$errorKeyJson});
  }
  if (error) sessionStorage.setItem({$errorKeyJson}, error);
} catch (storageError) {
  try {
    sessionStorage.setItem({$errorKeyJson}, "O iPhone bloqueou o armazenamento da sessão administrativa.");
  } catch (ignoredError) {}
} finally {
  window.location.replace({$destinationJson});
}
</script>
</body>
</html>
HTML;
    exit;
}
