<?php

declare(strict_types=1);

use AecSinuca\ApiException;
use AecSinuca\Database;
use AecSinuca\JsonResponse;
use AecSinuca\ScoreboardRoomService;

require_once __DIR__ . '/src/ApiException.php';
require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/JsonResponse.php';
require_once __DIR__ . '/src/ScoreboardState.php';
require_once __DIR__ . '/src/ScoreboardRoomService.php';

try {
    $configPath = getenv('AEC_SINUCA_CONFIG') ?: __DIR__ . '/config.local.php';
    if (!is_file($configPath)) {
        throw new ApiException('A API ainda não foi configurada.', 503);
    }
    $config = require $configPath;
    $options = (array) ($config['scoreboard_rooms'] ?? []);
    if (($options['enabled'] ?? false) !== true) {
        throw new ApiException('Salas de placar ainda não habilitadas.', 503);
    }
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'GET' && $method !== 'POST') {
        header('Allow: GET, POST');
        throw new ApiException('Método não permitido.', 405);
    }
    // Sem CORS: navegadores devem usar a API da própria origem.
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $origin = parse_url($_SERVER['HTTP_ORIGIN']);
        $host = strtolower((string) ($origin['host'] ?? ''));
        $authority = $host . (isset($origin['port']) ? ':' . $origin['port'] : '');
        if ($host === '' || $authority !== strtolower($_SERVER['HTTP_HOST'] ?? '')) {
            throw new ApiException('Origem não permitida.', 403);
        }
    }
    $input = [];
    if ($method === 'POST') {
        $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
        if ($contentType !== 'application/json') {
            throw new ApiException('Envie JSON com Content-Type application/json.', 415);
        }
        $body = file_get_contents('php://input', false, null, 0, 131073);
        if ($body === false || strlen($body) > 131072) {
            throw new ApiException('Requisição acima do limite de 128 KiB.', 413);
        }
        $input = json_decode($body, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($input) || array_is_list($input)) {
            throw new ApiException('Corpo JSON inválido.');
        }
    } elseif (($_GET['acao'] ?? 'status') !== 'status') {
        throw new ApiException('Use POST para operações de sala.', 405);
    }
    $database = Database::connect($config['database']);
    $service = new ScoreboardRoomService($database, (int) ($options['ttl_seconds'] ?? 86400));
    if ($method === 'GET') {
        JsonResponse::send($service->status());
    }
    // Não confiar em X-Forwarded-For fornecido pelo cliente.
    $action = $input['acao'] ?? '';
    if (!is_string($action)) {
        throw new ApiException('Ação inválida.');
    }
    JsonResponse::send($service->dispatch($action, $input, $_SERVER['REMOTE_ADDR'] ?? 'unknown'));
} catch (ApiException $error) {
    if ($error->statusCode() === 429) {
        header('Retry-After: 60');
    }
    JsonResponse::send(['erro' => $error->getMessage()], $error->statusCode());
} catch (JsonException $error) {
    JsonResponse::send(['erro' => 'JSON inválido.'], 400);
} catch (Throwable $error) {
    // Nunca retornar SQL, senha, token, config ou payload, mesmo em debug.
    JsonResponse::send(['erro' => 'Não foi possível acessar as salas. Confira as migrações 005 e 006 e a configuração da API.'], 500);
}
