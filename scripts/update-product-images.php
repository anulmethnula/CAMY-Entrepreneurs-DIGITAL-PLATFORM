<?php
declare(strict_types=1);

require __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/marketplace.php';

if (getenv('CAMY_ENV') === 'production') {
    fwrite(STDERR, "Refusing to update catalogue images in production.\n");
    exit(1);
}

function catalogue_image_for_product(array $product): ?string
{
    $category = strtoupper(trim((string)($product['category'] ?? '')));
    $name = strtoupper(trim((string)($product['name'] ?? '')));
    $map = [
        'WALL CLOCK' => '/products/wall-clock.png',
        'HELMET' => '/products/helmet.png',
        'AIR CONDITIONERS' => '/products/air-conditioner.png',
        'FAN' => '/products/stand-fan.png',
        'GAS COOKER' => '/products/gas-cooker.png',
        'TELEVISIONS' => '/products/smart-tv.png',
        'WATER FILTER' => '/products/water-filter.png',
        'MINI FRIDGE' => '/products/mini-fridge.jpeg',
        'DOUBLE DOOR FRIDGE' => '/products/double-door-fridge.jpeg',
        'PRESSURE COOKER' => '/products/pressure-cooker.png',
        'KETTLE' => '/products/kettle.png',
    ];
    if (isset($map[$category])) return $map[$category];
    if ($category === 'COOKWARE' && str_contains($name, 'FRY PAN')) return '/products/frypan-range.png';
    return null;
}

try {
    $pdo = database();
    $pdo->beginTransaction();
    $state = market_state($pdo, true);
    $updated = 0;
    $mapped = 0;
    $missing = [];
    foreach ($state['products'] as &$product) {
        $image = catalogue_image_for_product($product);
        if ($image === null) continue;
        $mapped++;
        $asset = __DIR__ . '/../public' . $image;
        if (!is_file($asset)) $missing[] = $image;
        if (($product['image'] ?? '') === $image) continue;
        $product['image'] = $image;
        $updated++;
    }
    unset($product);
    if ($missing) throw new RuntimeException('Missing product assets: ' . implode(', ', array_unique($missing)));
    market_save($pdo, $state);
    $pdo->commit();
    fwrite(STDOUT, "Catalogue images verified for {$mapped} products; {$updated} records changed.\n");
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, "Catalogue image update failed: " . $error->getMessage() . "\n");
    exit(1);
}
