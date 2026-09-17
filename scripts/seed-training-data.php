<?php
/**
 * CAMY training-data loader.
 *
 * Adds safe, fictional records for demonstrating every major screen. It is
 * additive: existing products, users, stock and orders are preserved.
 * Run: C:\xampp\php\php.exe scripts/seed-training-data.php
 */
declare(strict_types=1);

require __DIR__ . '/../api/config.php';
require __DIR__ . '/../api/marketplace.php';

if (!preg_match('/(?:training|test|demo)/i', (string) getenv('CAMY_DB_NAME'))) {
    fwrite(STDERR, "Training data requires a separate CAMY_DB_NAME containing training, test, or demo. The live database was not changed.\n");
    exit(1);
}

function read_state(PDO $db): array
{
    $db->exec("INSERT IGNORE INTO marketplace_state (id, state_json) VALUES (1, '{\"products\":[],\"entrepreneurs\":[],\"tiers\":[],\"requests\":[],\"inventory\":[],\"orders\":[]}')");
    $raw = $db->query('SELECT state_json FROM marketplace_state WHERE id = 1 FOR UPDATE')->fetchColumn();
    $state = json_decode((string) $raw, true);
    return is_array($state) ? $state : [];
}

function has_id(array $rows, string $id): bool
{
    foreach ($rows as $row) if ((string) ($row['id'] ?? '') === $id) return true;
    return false;
}

$db = database();
$db->beginTransaction();
try {
    $state = market_state($db, true);
    foreach (['products', 'entrepreneurs', 'tiers', 'requests', 'inventory', 'orders'] as $key) {
        if (!isset($state[$key]) || !is_array($state[$key])) $state[$key] = [];
    }

    if (!$state['products']) {
        $catalogue = json_decode((string) file_get_contents(__DIR__ . '/../database/demo_catalog.json'), true);
        $state['products'] = $catalogue['products'] ?? [];
        $state['tiers'] = $catalogue['tiers'] ?? [];
    }
    $state['catalogue_live'] = true;
    $state['training_data'] = true;

    // Make all real, active entrepreneur logins visible in the marketplace.
    $members = $db->query("SELECT u.member_id, u.full_name, e.city FROM users u LEFT JOIN entrepreneurs e ON e.user_id = u.id WHERE u.role = 'entrepreneur' AND u.status = 'active' AND u.member_id IS NOT NULL")->fetchAll();
    foreach ($members as $member) {
        if (!has_id($state['entrepreneurs'], (string) $member['member_id'])) {
            $state['entrepreneurs'][] = ['id' => (string) $member['member_id'], 'name' => (string) $member['full_name'], 'city' => (string) ($member['city'] ?: 'Sri Lanka'), 'stage' => 'Training seller', 'sales' => 0, 'credit' => 0, 'used' => 0];
        }
    }

    $demoPeople = [
        ['id' => 'DEMO-101', 'name' => 'Kandy Home Store (Demo)', 'city' => 'Kandy', 'stage' => 'Credit eligible', 'sales' => 284500, 'credit' => 20000, 'used' => 5400],
        ['id' => 'DEMO-102', 'name' => 'Galle Kitchen Hub (Demo)', 'city' => 'Galle', 'stage' => 'Credit eligible', 'sales' => 421000, 'credit' => 40000, 'used' => 12500],
        ['id' => 'DEMO-103', 'name' => 'Kurunegala Value Shop (Demo)', 'city' => 'Kurunegala', 'stage' => 'Trial seller', 'sales' => 68600, 'credit' => 0, 'used' => 0],
    ];
    foreach ($demoPeople as $person) if (!has_id($state['entrepreneurs'], $person['id'])) $state['entrepreneurs'][] = $person;

    if (!$state['tiers']) $state['tiers'] = [['sales' => 100000, 'credit' => 10000], ['sales' => 200000, 'credit' => 20000], ['sales' => 400000, 'credit' => 40000]];

    $productIds = array_values(array_filter(array_map(static fn($p) => (string) ($p['id'] ?? ''), $state['products'])));
    $stockPlan = [[0, 8], [2, 12], [3, 10], [5, 6], [7, 7]];
    foreach ($state['entrepreneurs'] as $personIndex => $person) {
        foreach ($stockPlan as [$position, $quantity]) {
            if (!isset($productIds[$position])) continue;
            $productId = $productIds[$position];
            $exists = false;
            foreach ($state['inventory'] as $item) if ((string) ($item['entrepreneurId'] ?? '') === (string) $person['id'] && (string) ($item['productId'] ?? '') === $productId) $exists = true;
            if (!$exists) {
                $product = null;
                foreach ($state['products'] as $candidate) if ((string) $candidate['id'] === $productId) $product = $candidate;
                $basePrice = (float) ($product['price'] ?? 1000);
                $state['inventory'][] = ['entrepreneurId' => (string) $person['id'], 'productId' => $productId, 'qty' => $quantity, 'price' => round($basePrice * 1.08, 2), 'visible' => true];
            }
        }
        // Each seller gets three orders, so the Orders and Growth views are populated.
        for ($i = 0; $i < 3; $i++) {
            $orderId = 'TRAIN-' . preg_replace('/[^A-Z0-9]/', '', (string) $person['id']) . '-' . ($i + 1);
            if (has_id($state['orders'], $orderId) || !isset($productIds[$i])) continue;
            $product = null; foreach ($state['products'] as $candidate) if ((string) $candidate['id'] === $productIds[$i]) $product = $candidate;
            $quantity = $i === 0 ? 1 : 2;
            $price = round((float) ($product['price'] ?? 1000) * 1.08, 2);
            $statuses = ['Processing', 'Dispatched', 'Delivered'];
            $state['orders'][] = ['id' => $orderId, 'groupId' => 'TRAIN-GROUP-' . preg_replace('/[^A-Z0-9]/', '', (string) $person['id']), 'customer' => ['Nimal Perera (Demo)', 'Ayesha Silva (Demo)', 'Kavindu Fernando (Demo)'][$i], 'phone' => '07700000' . ($i + 1), 'district' => (string) ($person['city'] ?? 'Colombo'), 'address' => 'Training address, ' . (string) ($person['city'] ?? 'Sri Lanka'), 'product' => (string) ($product['name'] ?? 'CAMY product'), 'items' => [['id' => $productIds[$i], 'name' => (string) ($product['name'] ?? 'CAMY product'), 'qty' => $quantity, 'price' => $price]], 'qty' => $quantity, 'amount' => $price * $quantity, 'date' => date('Y-m-d', strtotime('-' . (5 + $i) . ' days')), 'status' => $statuses[$i], 'entrepreneur' => (string) $person['name'], 'entrepreneurId' => (string) $person['id'], 'source' => 'training'];
        }
    }

    // Populate the normalized product table too, for database reporting.
    $upsert = $db->prepare("INSERT INTO products(code, name, category, description, price, stock, image, status) VALUES(?,?,?,?,?,?,?,'active') ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), description=VALUES(description), price=VALUES(price), stock=GREATEST(products.stock, VALUES(stock)), image=VALUES(image), status='active'");
    foreach ($state['products'] as $product) $upsert->execute([(string) ($product['code'] ?? $product['id']), (string) $product['name'], (string) ($product['category'] ?? 'CAMY Products'), (string) ($product['description'] ?? ''), (float) $product['price'], max(1, (int) ($product['stock'] ?? 1)), (string) ($product['image'] ?? '')]);

    market_save($db, $state);
    $db->commit();
    echo "Training data added: " . count($state['products']) . " products, " . count($state['entrepreneurs']) . " shops, " . count($state['inventory']) . " inventory items, and " . count($state['orders']) . " orders.\n";
} catch (Throwable $error) {
    if ($db->inTransaction()) $db->rollBack();
    fwrite(STDERR, 'Could not add training data: ' . $error->getMessage() . "\n");
    exit(1);
}
