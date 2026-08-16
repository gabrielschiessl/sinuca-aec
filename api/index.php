<?php

declare(strict_types=1);

use AecSinuca\ApiException;
use AecSinuca\AdminService;
use AecSinuca\AuthService;
use AecSinuca\Database;
use AecSinuca\JsonResponse;
use AecSinuca\PublicService;

require_once __DIR__ . '/src/ApiException.php';
require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/JsonResponse.php';
require_once __DIR__ . '/src/GoogleTokenVerifier.php';
require_once __DIR__ . '/src/AuthService.php';
require_once __DIR__ . '/src/AdminService.php';
require_once __DIR__ . '/src/StatisticsCalculator.php';
require_once __DIR__ . '/src/PublicService.php';

$configPath = getenv('AEC_SINUCA_CONFIG') ?: __DIR__ . '/config.local.php';

try {
    if (!is_file($configPath)) {
        throw new ApiException('A API ainda não foi configurada.', 503);
    }

    $config = require $configPath;
    $database = Database::connect($config['database']);
    $service = new PublicService($database);
    $auth = new AuthService(
        $database,
        (string) ($config['google_client_id'] ?? ''),
        (array) ($config['admin_emails'] ?? []),
        (int) ($config['session_duration_seconds'] ?? 2592000),
    );
    $admin = new AdminService($database, $auth, $service);
    $requestBody = [];
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        $rawBody = file_get_contents('php://input') ?: '{}';
        $requestBody = json_decode($rawBody, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($requestBody)) {
            throw new ApiException('Corpo da requisição inválido.');
        }
    }
    $action = (string) ($requestBody['acao'] ?? $_GET['acao'] ?? 'status');

    $result = match ($action) {
        'status' => [
            'status' => 'online',
            'sistema' => 'Projeto AEC Sinuca',
            'versao' => '2.0.0',
            'banco' => 'mysql',
        ],
        'temporadas' => $service->seasons(),
        'rodadas' => $service->rounds((string) ($_GET['serie'] ?? 'A'), $_GET['temporada'] ?? null),
        'estatisticas' => $service->statistics((string) ($_GET['serie'] ?? 'A'), $_GET['temporada'] ?? null),
        'ranking' => $service->ranking(),
        'login_google' => $auth->loginGoogle((string) ($requestBody['credential'] ?? '')),
        'validar_sessao' => $auth->validate((string) ($requestBody['token'] ?? '')),
        'logout' => $auth->logout((string) ($requestBody['token'] ?? '')),
        'admin_partidas' => $admin->matches(
            (string) ($requestBody['token'] ?? ''),
            (string) ($requestBody['divisao'] ?? 'A'),
        ),
        'admin_participantes' => $admin->participants(
            (string) ($requestBody['token'] ?? ''),
            (string) ($requestBody['divisao'] ?? 'A'),
        ),
        'admin_jogadores' => $admin->players((string) ($requestBody['token'] ?? '')),
        'admin_temporadas' => $admin->seasons((string) ($requestBody['token'] ?? '')),
        'admin_dados_planilha' => $admin->spreadsheetData(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
            (string) ($requestBody['divisao'] ?? 'A'),
        ),
        'salvar_taxa_inscricao' => $admin->saveRegistrationFee(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
            $requestBody['taxa'] ?? null,
        ),
        'salvar_referencia_ranking' => $admin->saveRankingReference(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
        ),
        'preparar_temporada' => $admin->prepareSeason(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
        ),
        'preparar_temporada_legada' => $admin->prepareLegacySeason(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
        ),
        'carregar_temporada' => $admin->loadSeason(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
        ),
        'salvar_temporada' => $admin->saveSeason(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
            (array) ($requestBody['participantes'] ?? []),
            (array) ($requestBody['rodadas'] ?? []),
        ),
        'salvar_temporada_atual' => $admin->saveActiveSeason(
            (string) ($requestBody['token'] ?? ''),
            (array) ($requestBody['participantes'] ?? []),
            (array) ($requestBody['rodadas'] ?? []),
        ),
        'salvar_temporada_legada' => $admin->saveLegacySeason(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
            (array) ($requestBody['participantes'] ?? []),
            (array) ($requestBody['rodadas'] ?? []),
        ),
        'publicar_temporada_legada' => $admin->publishLegacySeason(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
        ),
        'excluir_temporada' => $admin->deleteSeason(
            (string) ($requestBody['token'] ?? ''),
            $requestBody['temporada'] ?? null,
        ),
        'salvar_participantes' => $admin->saveParticipants(
            (string) ($requestBody['token'] ?? ''),
            (string) ($requestBody['divisao'] ?? ''),
            (array) ($requestBody['participantes'] ?? []),
            (array) ($requestBody['ativar_jogadores'] ?? []),
        ),
        'salvar_jogadores' => $admin->savePlayers(
            (string) ($requestBody['token'] ?? ''),
            (array) ($requestBody['jogadores'] ?? []),
        ),
        'salvar_partida' => $admin->saveMatch(
            (string) ($requestBody['token'] ?? ''),
            $requestBody,
        ),
        'salvar_partidas' => $admin->saveMatches(
            (string) ($requestBody['token'] ?? ''),
            (array) ($requestBody['partidas'] ?? []),
        ),
        'salvar_data_rodada' => $admin->saveRoundDate(
            (string) ($requestBody['token'] ?? ''),
            $requestBody,
        ),
        'salvar_datas_rodadas' => $admin->saveRoundDates(
            (string) ($requestBody['token'] ?? ''),
            (array) ($requestBody['rodadas'] ?? []),
        ),
        default => throw new ApiException('Ação inválida.', 404),
    };

    JsonResponse::send($result);
} catch (ApiException $error) {
    JsonResponse::send(['erro' => $error->getMessage()], $error->statusCode());
} catch (Throwable $error) {
    $debug = isset($config) && ($config['debug'] ?? false);
    JsonResponse::send(
        ['erro' => $debug ? $error->getMessage() : 'Erro inesperado ao acessar a API.'],
        500,
    );
}
