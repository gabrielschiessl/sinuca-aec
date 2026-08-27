<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/src/ApiException.php';
require_once __DIR__ . '/../api/src/ScoreboardState.php';

use AecSinuca\ApiException;
use AecSinuca\ScoreboardState;

$base = ['names' => ['Jogador 1', 'Jogador 2'], 'points' => [12, 7],
    'wins' => [1, 0], 'history' => [], 'breakPlayer' => 0, 'strokeScore' => 5];
if (ScoreboardState::normalize($base) !== $base) {
    throw new RuntimeException('Estado válido alterado inesperadamente.');
}
$frame = ['date' => '2026-08-27T12:00:00.000Z', 'points' => [12, 7], 'winner' => 0];
$validHistory = $base;
$validHistory['history'] = [$frame];
ScoreboardState::normalize($validHistory);

$invalid = [
    array_replace($base, ['points' => [-1, 7]]),
    array_replace($base, ['points' => ['12', 7]]),
    array_replace($base, ['points' => [1, 2, 3]]),
    array_replace($base, ['wins' => [0, 10000]]),
    array_replace($base, ['strokeScore' => 1.5]),
    array_replace($base, ['breakPlayer' => 2]),
    array_replace($base, ['names' => ['', 'B']]),
    array_replace($base, ['names' => [str_repeat('A', 41), 'B']]),
    array_replace($base, ['names' => ["A\nB", 'B']]),
    array_replace($base, ['history' => array_fill(0, 501, $frame)]),
    array_replace($base, ['history' => [array_replace($frame, ['winner' => 1])]]),
    array_replace($base, ['history' => [array_replace($frame, ['date' => '2026-02-30T12:00:00.000Z'])]]),
];
foreach ($invalid as $index => $state) {
    try {
        ScoreboardState::normalize($state);
    } catch (ApiException $error) {
        continue;
    }
    throw new RuntimeException('Caso inválido aceito: ' . $index);
}
echo "OK: estado válido, histórico e 12 casos inválidos.\n";
