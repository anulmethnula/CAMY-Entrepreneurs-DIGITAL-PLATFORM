<?php
declare(strict_types=1);

require __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/marketplace.php';

if (getenv('CAMY_ENV') === 'production') {
    fwrite(STDERR, "Refusing to import the local workbook catalogue in production.\n");
    exit(1);
}

try {
    $pdo = database();
    $pdo->beginTransaction();
    $state = market_state($pdo, true);
    $source = catalogue_demo_data()['products'];
    $existingByCode = [];
    $maxId = 999;
    foreach ($state['products'] ?? [] as $index => $product) {
        $existingByCode[strtolower(trim((string)($product['code'] ?? '')))] = $index;
        if (ctype_digit((string)($product['id'] ?? ''))) $maxId = max($maxId, (int)$product['id']);
    }

    $added = 0;
    $updated = 0;
    foreach ($source as $product) {
        $key = strtolower(trim((string)$product['code']));
        if (array_key_exists($key, $existingByCode)) {
            $index = $existingByCode[$key];
            $current = $state['products'][$index];
            $state['products'][$index] = array_merge($product, [
                'id' => $current['id'],
                'stock' => (int)($current['stock'] ?? 0),
                'published' => ($current['published'] ?? true) === true,
                'image' => $current['image'] ?? $product['image'],
                'media' => $current['media'] ?? ($product['media'] ?? []),
            ]);
            $updated++;
            continue;
        }
        $product['id'] = ++$maxId;
        $state['products'][] = $product;
        $existingByCode[$key] = array_key_last($state['products']);
        $added++;
    }

    $state['products'] = catalogue_products($state['products']);
    $state['catalogue_seeded'] = true;
    market_save($pdo, $state);
    $pdo->commit();
    fwrite(STDOUT, "CAMY price list imported: {$added} added, {$updated} updated, " . count($state['products']) . " total products.\n");
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, "CAMY price-list import failed: " . $error->getMessage() . "\n");
    exit(1);
}
