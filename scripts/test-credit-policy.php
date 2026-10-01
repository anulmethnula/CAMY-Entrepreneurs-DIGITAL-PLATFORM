<?php
declare(strict_types=1);

function response(array $data, int $status = 200): never {
    throw new RuntimeException(($data['message'] ?? 'Unexpected response')." ($status)");
}

require __DIR__.'/../api/catalogue.php';

$tiers = [
    ['id'=>'tier-1','sales'=>100000,'credit'=>10000],
    ['id'=>'tier-2','sales'=>200000,'credit'=>20000],
    ['id'=>'tier-3','sales'=>300000,'credit'=>30000],
    ['id'=>'tier-4','sales'=>400000,'credit'=>40000],
];

$sellingValue = catalogue_order_sales_value([
    'amount' => 190000,
    'camyCost' => 100000,
    'entrepreneurMargin' => 90000,
    'items' => [
        ['price' => 60000, 'qty' => 2],
        ['price' => 30000, 'qty' => 2],
    ],
]);

if ($sellingValue !== 180000.0) {
    throw new RuntimeException("Expected product selling value 180000, got $sellingValue");
}
if (catalogue_credit_for_sales($tiers, $sellingValue) !== 10000.0) {
    throw new RuntimeException('Selling value did not unlock the expected first-tier credit.');
}
if (catalogue_credit_for_sales($tiers, 99999.99) !== 0.0 || catalogue_credit_for_sales($tiers, 200000) !== 20000.0 || catalogue_credit_for_sales($tiers, 1764850) !== 40000.0) {
    throw new RuntimeException('Credit ladder boundaries are incorrect.');
}

$state = [
    'entrepreneurs' => [['id' => 'CE-TEST', 'stage' => 'Trial seller']],
    'orders' => [[
        'entrepreneurId' => 'CE-TEST',
        'status' => 'Delivered',
        'amount' => 130000,
        'camyCost' => 100000,
        'entrepreneurMargin' => 30000,
        'items' => [['price' => 65000, 'qty' => 2]],
    ]],
    'tiers' => $tiers,
];
catalogue_credit($state);
if ($state['entrepreneurs'][0]['sales'] !== 130000.0 || $state['entrepreneurs'][0]['credit'] !== 10000.0) {
    throw new RuntimeException('Delivered selling value was not applied to the entrepreneur account.');
}

echo "PASS: credit tiers use delivered product selling value, not profit or delivery charges.\n";
