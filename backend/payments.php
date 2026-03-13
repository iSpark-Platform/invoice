<?php
require_once __DIR__ . '/config.php';
setCORSHeaders();

validateToken();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$db     = getDB();

function getPaymentRow(PDO $db, int $id): ?array {
    $stmt = $db->prepare(
        "SELECT p.*, i.invoice_number, s.name AS school_name, s.district AS school_district
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         JOIN schools  s ON s.id = i.school_id
         WHERE p.id = ?"
    );
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

// ── GET list ──
if ($method === 'GET' && !$id) {
    $stmt = $db->query(
        "SELECT p.*, i.invoice_number, s.name AS school_name, s.district AS school_district
         FROM payments p
         JOIN invoices i ON i.id = p.invoice_id
         JOIN schools  s ON s.id = i.school_id
         ORDER BY p.created_at DESC"
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['tds_deducted'] = (bool)$r['tds_deducted'];
    }
    jsonResponse($rows);
}

// ── GET single ──
if ($method === 'GET' && $id) {
    $row = getPaymentRow($db, $id);
    if (!$row) jsonError('Not found', 404);
    $row['tds_deducted'] = (bool)$row['tds_deducted'];
    jsonResponse($row);
}

// ── POST create ──
if ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);
    foreach (['invoice', 'amount', 'mode', 'date'] as $f) {
        if (empty($b[$f])) jsonError("Field '$f' is required");
    }

    $tdsDeducted = (bool)($b['tds_deducted'] ?? false);
    $amount      = (float)$b['amount'];
    $tdsAmount   = $tdsDeducted ? (float)($b['tds_amount']  ?? 0) : 0;
    $netAmount   = $tdsDeducted ? (float)($b['net_amount']  ?? $amount) : $amount;

    $stmt = $db->prepare(
        "INSERT INTO payments (invoice_id,amount,tds_deducted,tds_amount,net_amount,mode,reference,date,status)
         VALUES (?,?,?,?,?,?,?,?,'completed')"
    );
    $stmt->execute([
        (int)$b['invoice'], $amount,
        $tdsDeducted ? 1 : 0,
        $tdsAmount, $netAmount,
        $b['mode'],
        $b['reference'] ?? '',
        $b['date'],
    ]);
    $newId = $db->lastInsertId();
    $row   = getPaymentRow($db, $newId);
    $row['tds_deducted'] = (bool)$row['tds_deducted'];
    jsonResponse($row, 201);
}

// ── PUT update ──
if ($method === 'PUT' && $id) {
    $b = json_decode(file_get_contents('php://input'), true);

    $tdsDeducted = (bool)($b['tds_deducted'] ?? false);
    $amount      = (float)($b['amount'] ?? 0);
    $tdsAmount   = $tdsDeducted ? (float)($b['tds_amount'] ?? 0) : 0;
    $netAmount   = $tdsDeducted ? (float)($b['net_amount'] ?? $amount) : $amount;

    $db->prepare(
        "UPDATE payments SET invoice_id=?,amount=?,tds_deducted=?,tds_amount=?,net_amount=?,
         mode=?,reference=?,date=?,status=? WHERE id=?"
    )->execute([
        (int)$b['invoice'], $amount,
        $tdsDeducted ? 1 : 0,
        $tdsAmount, $netAmount,
        $b['mode'],
        $b['reference'] ?? '',
        $b['date'],
        $b['status'] ?? 'completed',
        $id,
    ]);
    $row = getPaymentRow($db, $id);
    $row['tds_deducted'] = (bool)$row['tds_deducted'];
    jsonResponse($row);
}

// ── DELETE ──
if ($method === 'DELETE' && $id) {
    $db->prepare("DELETE FROM payments WHERE id = ?")->execute([$id]);
    jsonResponse(['message' => 'Deleted']);
}

jsonError('Not found', 404);
