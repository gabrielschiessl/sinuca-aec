<?php

declare(strict_types=1);

namespace AecSinuca;

use DOMDocument;
use DOMElement;
use DOMXPath;
use ZipArchive;

final class RegulationDocumentGenerator
{
    private const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    private const COMMISSION_MEMBERS = [
        'Oséas — presidente;',
        'Gáz — vice-presidente;',
        'Toninho;',
        'Hélcio;',
        'Maia.',
    ];

    public function __construct(private readonly string $templatePath)
    {
    }

    public function generate(int $year, float $fee, string $startDate, string $endDate): string
    {
        if (!class_exists(ZipArchive::class)) {
            throw new ApiException('A extensão ZIP do PHP é necessária para gerar o regulamento.', 500);
        }
        if (!is_file($this->templatePath)) {
            throw new ApiException('O modelo do regulamento não foi encontrado.', 500);
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'aec-regulamento-');
        if ($temporaryPath === false || !copy($this->templatePath, $temporaryPath)) {
            throw new ApiException('Não foi possível preparar o regulamento.', 500);
        }

        try {
            $archive = new ZipArchive();
            if ($archive->open($temporaryPath) !== true) {
                throw new ApiException('Não foi possível abrir o modelo do regulamento.', 500);
            }
            try {
                $documentXml = $archive->getFromName('word/document.xml');
                $numberingXml = $archive->getFromName('word/numbering.xml');
                if ($documentXml === false || $numberingXml === false) {
                    throw new ApiException('O modelo do regulamento está incompleto.', 500);
                }
                $archive->addFromString(
                    'word/document.xml',
                    $this->documentXml($documentXml, $year, $fee, $startDate, $endDate),
                );
                $archive->addFromString('word/numbering.xml', $this->numberingXml($numberingXml));
            } finally {
                $archive->close();
            }

            $content = file_get_contents($temporaryPath);
            if ($content === false) {
                throw new ApiException('Não foi possível finalizar o regulamento.', 500);
            }
            return $content;
        } finally {
            if (is_file($temporaryPath)) {
                unlink($temporaryPath);
            }
        }
    }

    private function documentXml(
        string $xml,
        int $year,
        float $fee,
        string $startDate,
        string $endDate,
    ): string {
        [$document, $xpath] = $this->xml($xml);
        $replacements = 0;
        $formattedFee = $this->formatMoney($fee);
        $feeInWords = $this->currencyInPortuguese($fee);

        foreach ($xpath->query('//w:t') ?: [] as $textNode) {
            $text = $textNode->textContent;
            if ($text === 'ANO' || preg_match('/^\d{4}$/', $text) === 1 && $replacements === 0) {
                $textNode->nodeValue = (string) $year;
                $replacements++;
                continue;
            }
            if (str_starts_with($text, 'Participarão do campeonato os jogadores do ranking')) {
                $base = preg_replace(
                    '/, com início em \d{2}\/\d{2}\/\d{4} e término em \d{2}\/\d{2}\/\d{4}\.$/u',
                    '.',
                    $text,
                ) ?? $text;
                $textNode->nodeValue = rtrim($base, ". \t\n\r\0\x0B")
                    . ", com início em {$startDate} e término em {$endDate}.";
                $replacements++;
                continue;
            }
            if (str_starts_with($text, 'Haverá uma taxa de participação por jogador')) {
                $textNode->nodeValue = preg_replace(
                    '/R\$\s*[\d.]+,\d{2}/u',
                    $formattedFee,
                    $text,
                    1,
                ) ?? $text;
                $replacements++;
                continue;
            }
            if (str_starts_with($text, 'A taxa de inscrição não dará direito')) {
                $updated = preg_replace('/R\$\s*[\d.]+,\d{2}/u', $formattedFee, $text, 1) ?? $text;
                $textNode->nodeValue = preg_replace(
                    '/\([^)]*reais(?: e [^)]*centavos)?\)/u',
                    "({$feeInWords})",
                    $updated,
                    1,
                ) ?? $updated;
                $replacements++;
            }
        }

        if ($replacements !== 4) {
            throw new ApiException('O modelo do regulamento não possui todos os campos parametrizados.', 500);
        }

        foreach (self::COMMISSION_MEMBERS as $member) {
            $paragraph = null;
            foreach ($xpath->query('//w:p') ?: [] as $candidate) {
                if (trim($candidate->textContent) === $member) {
                    $paragraph = $candidate;
                    break;
                }
            }
            if (!$paragraph instanceof DOMElement) {
                throw new ApiException('A lista da comissão não foi encontrada no regulamento.', 500);
            }
            $numberId = $xpath->query('./w:pPr/w:numPr/w:numId', $paragraph)?->item(0);
            if (!$numberId instanceof DOMElement) {
                throw new ApiException('A numeração da comissão está incompleta.', 500);
            }
            $numberId->setAttributeNS(self::WORD_NAMESPACE, 'w:val', '3');
        }

        return $this->saveXml($document);
    }

    private function numberingXml(string $xml): string
    {
        [$document, $xpath] = $this->xml($xml);
        $mainLevel = $xpath->query('//w:abstractNum[@w:abstractNumId="2"]/w:lvl[@w:ilvl="0"]')?->item(0);
        $nestedLevel = $xpath->query('//w:abstractNum[@w:abstractNumId="2"]/w:lvl[@w:ilvl="1"]')?->item(0);
        if (!$mainLevel instanceof DOMElement || !$nestedLevel instanceof DOMElement) {
            throw new ApiException('A numeração principal do regulamento não foi encontrada.', 500);
        }

        $runProperties = $xpath->query('./w:rPr', $mainLevel)?->item(0);
        if (!$runProperties instanceof DOMElement) {
            $runProperties = $document->createElementNS(self::WORD_NAMESPACE, 'w:rPr');
            $mainLevel->appendChild($runProperties);
        }
        foreach (['sz', 'szCs'] as $tag) {
            $size = $xpath->query("./w:{$tag}", $runProperties)?->item(0);
            if (!$size instanceof DOMElement) {
                $size = $document->createElementNS(self::WORD_NAMESPACE, "w:{$tag}");
                $runProperties->appendChild($size);
            }
            $size->setAttributeNS(self::WORD_NAMESPACE, 'w:val', '24');
        }

        $nestedFormat = $xpath->query('./w:numFmt', $nestedLevel)?->item(0);
        $nestedText = $xpath->query('./w:lvlText', $nestedLevel)?->item(0);
        if (!$nestedFormat instanceof DOMElement || !$nestedText instanceof DOMElement) {
            throw new ApiException('A numeração interna do regulamento está incompleta.', 500);
        }
        $nestedFormat->setAttributeNS(self::WORD_NAMESPACE, 'w:val', 'lowerLetter');
        $nestedText->setAttributeNS(self::WORD_NAMESPACE, 'w:val', '%2.');

        foreach ($xpath->query('//w:num[@w:numId="3"]') ?: [] as $existing) {
            $existing->parentNode?->removeChild($existing);
        }
        $commissionNumber = $document->createElementNS(self::WORD_NAMESPACE, 'w:num');
        $commissionNumber->setAttributeNS(self::WORD_NAMESPACE, 'w:numId', '3');
        $abstractNumberId = $document->createElementNS(self::WORD_NAMESPACE, 'w:abstractNumId');
        $abstractNumberId->setAttributeNS(self::WORD_NAMESPACE, 'w:val', '2');
        $commissionNumber->appendChild($abstractNumberId);
        $override = $document->createElementNS(self::WORD_NAMESPACE, 'w:lvlOverride');
        $override->setAttributeNS(self::WORD_NAMESPACE, 'w:ilvl', '1');
        $commissionLevel = $nestedLevel->cloneNode(true);
        if (!$commissionLevel instanceof DOMElement) {
            throw new ApiException('Não foi possível preparar a lista da comissão.', 500);
        }
        $commissionFormat = $xpath->query('./w:numFmt', $commissionLevel)?->item(0);
        $commissionFormat?->setAttributeNS(self::WORD_NAMESPACE, 'w:val', 'decimal');
        $override->appendChild($commissionLevel);
        $commissionNumber->appendChild($override);
        $document->documentElement?->appendChild($commissionNumber);

        return $this->saveXml($document);
    }

    private function xml(string $content): array
    {
        $document = new DOMDocument('1.0', 'UTF-8');
        $document->preserveWhiteSpace = true;
        if (!$document->loadXML($content, LIBXML_NONET)) {
            throw new ApiException('O XML interno do regulamento é inválido.', 500);
        }
        $xpath = new DOMXPath($document);
        $xpath->registerNamespace('w', self::WORD_NAMESPACE);
        return [$document, $xpath];
    }

    private function saveXml(DOMDocument $document): string
    {
        $xml = $document->saveXML();
        if ($xml === false) {
            throw new ApiException('Não foi possível atualizar o regulamento.', 500);
        }
        return $xml;
    }

    private function formatMoney(float $value): string
    {
        return 'R$ ' . number_format($value, 2, ',', '.');
    }

    private function currencyInPortuguese(float $value): string
    {
        $totalCents = (int) round($value * 100);
        $reais = intdiv($totalCents, 100);
        $cents = $totalCents % 100;
        $parts = [$this->numberInPortuguese($reais) . ($reais === 1 ? ' real' : ' reais')];
        if ($cents > 0) {
            $parts[] = $this->numberInPortuguese($cents) . ($cents === 1 ? ' centavo' : ' centavos');
        }
        return implode(' e ', $parts);
    }

    private function numberInPortuguese(int $value): string
    {
        $units = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
        $teens = [10 => 'dez', 11 => 'onze', 12 => 'doze', 13 => 'treze', 14 => 'quatorze', 15 => 'quinze', 16 => 'dezesseis', 17 => 'dezessete', 18 => 'dezoito', 19 => 'dezenove'];
        $tens = [20 => 'vinte', 30 => 'trinta', 40 => 'quarenta', 50 => 'cinquenta', 60 => 'sessenta', 70 => 'setenta', 80 => 'oitenta', 90 => 'noventa'];
        $hundreds = [100 => 'cem', 200 => 'duzentos', 300 => 'trezentos', 400 => 'quatrocentos', 500 => 'quinhentos', 600 => 'seiscentos', 700 => 'setecentos', 800 => 'oitocentos', 900 => 'novecentos'];
        if ($value < 10) {
            return $units[$value];
        }
        if ($value < 20) {
            return $teens[$value];
        }
        if ($value < 100) {
            $base = intdiv($value, 10) * 10;
            $remainder = $value % 10;
            return $tens[$base] . ($remainder ? ' e ' . $units[$remainder] : '');
        }
        if ($value < 1000) {
            $base = intdiv($value, 100) * 100;
            $remainder = $value % 100;
            $prefix = $base === 100 && $remainder > 0 ? 'cento' : $hundreds[$base];
            return $prefix . ($remainder ? ' e ' . $this->numberInPortuguese($remainder) : '');
        }
        if ($value < 1000000) {
            $thousands = intdiv($value, 1000);
            $remainder = $value % 1000;
            $prefix = $thousands === 1 ? 'mil' : $this->numberInPortuguese($thousands) . ' mil';
            return $prefix . ($remainder ? ' e ' . $this->numberInPortuguese($remainder) : '');
        }
        return number_format($value, 0, ',', '.');
    }
}
