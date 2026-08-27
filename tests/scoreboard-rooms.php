<?php

declare(strict_types=1);

// Somente CLI e banco descartável, com 001, 005 e 006 já aplicados.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
$path = getenv('AEC_SCOREBOARD_TEST_CONFIG');
if (!$path || !is_file($path)) {
    throw new RuntimeException('Informe AEC_SCOREBOARD_TEST_CONFIG com uma configuração PHP de banco descartável.');
}
$config = require $path;
if (($config['scoreboard_test_database'] ?? false) !== true) {
    throw new RuntimeException('A configuração deve declarar scoreboard_test_database => true. Nunca use o banco real.');
}
require_once __DIR__ . '/../api/src/ApiException.php';
require_once __DIR__ . '/../api/src/Database.php';
require_once __DIR__ . '/../api/src/ScoreboardState.php';
require_once __DIR__ . '/../api/src/ScoreboardRoomService.php';

use AecSinuca\ApiException;
use AecSinuca\Database;
use AecSinuca\ScoreboardRoomService;

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}
function rejects(callable $call, int $status): void
{
    try {
        $call();
    } catch (ApiException $error) {
        check($error->statusCode() === $status, 'Status de erro inesperado.');
        return;
    }
    throw new RuntimeException('Operação indevida foi aceita.');
}
$db = Database::connect($config['database']);
$service = new ScoreboardRoomService($db);
$ip = 'test-' . bin2hex(random_bytes(12));
$call = fn ($action, $payload) => $service->dispatch($action, $payload, $ip);
$state = ['names' => ['Teste A', 'Teste B'], 'points' => [0, 0], 'wins' => [0, 0],
    'history' => [], 'breakPlayer' => 0, 'strokeScore' => 0];
$rooms = [];
try {
    $first = $call('criar', ['senha' => '0123', 'estado' => $state]);
    $rooms[] = $first['codigo'];
    $second = $call('criar', ['senha' => '0456', 'estado' => $state]);
    $rooms[] = $second['codigo'];
    check((bool) preg_match('/^[0-9]{6}$/D', $first['codigo']) && $first['codigo'] !== '000000', 'Código numérico inválido.');
    rejects(fn () => $call('consultar', ['codigo' => '000000']), 400);
    rejects(fn () => $call('assumir_controle', ['codigo' => $first['codigo'], 'senha' => '123']), 400);
    rejects(fn () => $call('assumir_controle', ['codigo' => $first['codigo'], 'senha' => '1a23']), 400);
    $read = $call('consultar', ['codigo' => $first['codigo'], 'versao' => 1]);
    check(!$read['alterado'] && !isset($read['estado']) && !isset($read['controller_token']), 'Resposta pública incorreta.');
    rejects(fn () => $call('assumir_controle', ['codigo' => $first['codigo'], 'senha' => '9999']), 403);
    $transfer = $call('assumir_controle', ['codigo' => $first['codigo'], 'senha' => '0123']);
    check($transfer['controller_token'] !== $first['controller_token'], 'Token não foi rotacionado.');
    $state['points'][0] = 7;
    $state['strokeScore'] = 7;
    $write = ['codigo' => $first['codigo'], 'controller_token' => $first['controller_token'],
        'versao' => $transfer['versao'], 'comando_id' => '00000000-0000-4000-8000-000000000001', 'estado' => $state];
    rejects(fn () => $call('atualizar', $write), 403);
    $write['controller_token'] = $transfer['controller_token'];
    $saved = $call('atualizar', $write);
    $repeat = $call('atualizar', $write);
    check($repeat['repetido'] && $repeat['versao'] === $saved['versao'], 'Repetição alterou pontos/versão.');
    rejects(fn () => $call('atualizar', array_replace($write, ['comando_id' => '00000000-0000-4000-8000-000000000002'])), 409);
    $changed = $write;
    $changed['estado']['points'][0] = 8;
    rejects(fn () => $call('atualizar', $changed), 409);
    $other = $call('consultar', ['codigo' => $second['codigo']]);
    check($other['estado']['points'] === [0, 0], 'Uma sala alterou a outra.');
    $old = $call('consultar', ['codigo' => $first['codigo'], 'controller_token' => $first['controller_token']]);
    check(!$old['controle_ativo'], 'Controle antigo continua ativo.');
    $close = ['codigo' => $first['codigo'], 'controller_token' => $transfer['controller_token'],
        'versao' => $saved['versao'], 'comando_id' => '00000000-0000-4000-8000-000000000003'];
    check($call('encerrar', $close)['encerrada'], 'Sala não encerrou.');
    check($call('encerrar', $close)['repetido'], 'Repetição de encerramento falhou.');
    rejects(fn () => $call('assumir_controle', ['codigo' => $first['codigo'], 'senha' => '0123']), 410);
    $expire = $db->prepare('UPDATE scoreboard_rooms SET expires_at = ? WHERE room_code = ?');
    $expire->execute(['2000-01-01 00:00:00', $second['codigo']]);
    rejects(fn () => $call('consultar', ['codigo' => $second['codigo']]), 410);
    // Exercise the collision/reuse branch deterministically, without filling the pool.
    $reuse = new ReflectionMethod(ScoreboardRoomService::class, 'reuseExpiredCode');
    $newToken = bin2hex(random_bytes(32));
    $args = [$second['codigo'], $newToken, password_hash('0789', PASSWORD_DEFAULT), json_encode($state), gmdate('Y-m-d H:i:s', time() + 86400)];
    check($reuse->invokeArgs($service, $args), 'Código expirado não foi reutilizado.');
    check(!$reuse->invokeArgs($service, $args), 'Sala ativa foi sobrescrita.');
    $renewed = $call('consultar', ['codigo' => $second['codigo'], 'versao' => $second['versao']]);
    check($renewed['alterado'] && $renewed['versao'] > $second['versao'], 'Versão da sala reutilizada foi reiniciada.');
    rejects(fn () => $call('atualizar', array_replace($write, ['codigo' => $second['codigo'], 'controller_token' => $second['controller_token'], 'versao' => $renewed['versao']])), 403);
    rejects(fn () => $call('assumir_controle', ['codigo' => $second['codigo'], 'senha' => '0456']), 403);
    check($call('assumir_controle', ['codigo' => $second['codigo'], 'senha' => '0789'])['controle_ativo'], 'PIN renovado não funcionou.');
    for ($i = 0; $i < 3; $i++) {
        rejects(fn () => $call('criar', ['senha' => 'curta', 'estado' => $state]), 400);
    }
    rejects(fn () => $call('criar', ['senha' => 'curta', 'estado' => $state]), 429);
    echo "OK: criação, senha, transferência, revogação, conflito, repetição, isolamento, encerramento e expiração.\n";
} finally {
    $delete = $db->prepare('DELETE FROM scoreboard_rooms WHERE room_code = ?');
    foreach ($rooms as $code) {
        $delete->execute([$code]);
        $bucket = $db->prepare('DELETE FROM scoreboard_rate_limits WHERE bucket_hash = ?');
        $bucket->execute([hash('sha256', 'takeover-room:' . $code)]);
    }
    $deleteLimit = $db->prepare('DELETE FROM scoreboard_rate_limits WHERE bucket_hash = ?');
    foreach (['requests:', 'create:', 'takeover:'] as $scope) {
        $deleteLimit->execute([hash('sha256', $scope . $ip)]);
    }
    // Buckets globais permanecem; não remover estado compartilhado com outros testes.
}
