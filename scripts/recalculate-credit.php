<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/config.php';
require_once __DIR__ . '/../api/marketplace.php';

$pdo = database();
$pdo->beginTransaction();

try {
    $state = market_state($pdo, true);
    catalogue_credit($state);
    market_save($pdo, $state);
    $pdo->commit();

    foreach ($state['entrepreneurs'] as $person) {
        printf(
            "%s: sales Rs. %s -> credit Rs. %s\n",
            $person['id'],
            number_format((float)$person['sales'], 2),
            number_format((float)$person['credit'], 2),
        );
    }
} catch (Throwable $error) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}
