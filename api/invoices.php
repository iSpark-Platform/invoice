<?php
require_once __DIR__ . '/config.php';
setCORSHeaders();

validateToken();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$action = $_GET['action']    ?? '';
$db     = getDB();

// ─── Helper: get invoice with school info ────────────────
function getInvoiceRow($db, $id) {
    $stmt = $db->prepare(
        "SELECT i.*, s.name AS school_name, s.district AS school_district,
                s.address, s.state, s.pincode, s.email AS school_email
         FROM invoices i
         JOIN schools s ON s.id = i.school_id
         WHERE i.id = ?"
    );
    $stmt->execute([$id]);
    return $stmt->fetch() ?: null;
}

// ─── Build financial year ─────────────────────────────────
function getFinancialYear($invoiceMonth) {
    if ($invoiceMonth) {
        $dt      = new DateTime($invoiceMonth . '-01');
        $fyStart = $dt->format('n') >= 4 ? (int)$dt->format('Y') : (int)$dt->format('Y') - 1;
    } else {
        $today   = new DateTime();
        $fyStart = (int)$today->format('n') >= 4 ? (int)$today->format('Y') : (int)$today->format('Y') - 1;
    }
    $fyEnd     = $fyStart + 1;
    $fyStr     = substr((string)$fyStart, -2) . substr((string)$fyEnd, -2);
    $fyDisplay = $fyStart . '-' . substr((string)$fyEnd, -2);
    return [$fyStr, $fyDisplay];
}

// ─── GET dashboard ───────────────────────────────────────
if ($method === 'GET' && $action === 'dashboard') {
    $today   = new DateTime();
    $fyStart = (int)$today->format('n') >= 4 ? (int)$today->format('Y') : (int)$today->format('Y') - 1;
    $fyEnd   = $fyStart + 1;
    $fyStr   = substr((string)$fyStart, -2) . substr((string)$fyEnd, -2);

    $r = function($sql, $p = []) use ($db) {
        $s = $db->prepare($sql); $s->execute($p); return $s->fetchColumn();
    };

    $totalSchools  = $db->query("SELECT COUNT(*) FROM schools")->fetchColumn();
    $totalInvoices = $db->query("SELECT COUNT(*) FROM invoices")->fetchColumn();
    $totalPayments = $db->query("SELECT COUNT(*) FROM payments")->fetchColumn();
    $totalRevenue  = $r("SELECT COALESCE(SUM(total),0) FROM invoices");
    $paidAmount    = $r("SELECT COALESCE(SUM(total),0) FROM invoices WHERE status='paid'");
    $fyRevenue     = $r("SELECT COALESCE(SUM(total),0) FROM invoices WHERE financial_year=?", [$fyStr]);
    $fyPaid        = $r("SELECT COALESCE(SUM(total),0) FROM invoices WHERE financial_year=? AND status='paid'", [$fyStr]);

    $monthlyData = [];
    for ($i = 11; $i >= 0; $i--) {
        $d     = new DateTime("first day of -$i months");
        $month = $d->format('Y-m');
        $label = $d->format('M Y');
        $rev   = $r("SELECT COALESCE(SUM(total),0) FROM invoices WHERE invoice_month=?", [$month]);
        $monthlyData[] = ['month' => $label, 'revenue' => (float)$rev];
    }

    $statusData = [];
    foreach (['draft','sent','paid','overdue','cancelled'] as $s) {
        $cnt = $r("SELECT COUNT(*) FROM invoices WHERE status=?", [$s]);
        $amt = $r("SELECT COALESCE(SUM(total),0) FROM invoices WHERE status=?", [$s]);
        $statusData[] = ['status' => $s, 'count' => (int)$cnt, 'amount' => (float)$amt];
    }

    jsonResponse([
        'total_schools'  => (int)$totalSchools,
        'total_invoices' => (int)$totalInvoices,
        'total_payments' => (int)$totalPayments,
        'total_revenue'  => (float)$totalRevenue,
        'paid_amount'    => (float)$paidAmount,
        'fy_str'         => "$fyStart-" . substr((string)$fyEnd, -2),
        'fy_revenue'     => (float)$fyRevenue,
        'fy_paid'        => (float)$fyPaid,
        'monthly_data'   => $monthlyData,
        'status_data'    => $statusData,
    ]);
}

// ─── GET reports ─────────────────────────────────────────
if ($method === 'GET' && $action === 'reports') {
    $fyFilter = $_GET['fy'] ?? '';

    $stmt = $db->query("SELECT DISTINCT financial_year FROM invoices ORDER BY financial_year");
    $fys  = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $fySummary = [];
    foreach ($fys as $fy) {
        $stmt = $db->prepare("SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total, COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) AS paid FROM invoices WHERE financial_year=?");
        $stmt->execute([$fy]);
        $row = $stmt->fetch();
        $fySummary[] = ['financial_year' => $fy, 'count' => (int)$row['cnt'], 'total' => (float)$row['total'], 'paid' => (float)$row['paid']];
    }

    $whereClause = $fyFilter ? "WHERE i.financial_year = ?" : "";
    $params      = $fyFilter ? [$fyFilter] : [];
    $stmt = $db->prepare(
        "SELECT s.name AS school__name, s.district AS school__district,
                COUNT(*) AS count,
                COALESCE(SUM(i.total),0) AS total,
                COALESCE(SUM(CASE WHEN i.status='paid' THEN i.total ELSE 0 END),0) AS paid
         FROM invoices i JOIN schools s ON s.id = i.school_id
         $whereClause
         GROUP BY i.school_id ORDER BY total DESC"
    );
    $stmt->execute($params);
    $schoolReport = $stmt->fetchAll();
    foreach ($schoolReport as &$r) {
        $r['total'] = (float)$r['total'];
        $r['paid']  = (float)$r['paid'];
        $r['count'] = (int)$r['count'];
    }

    $stmt = $db->prepare(
        "SELECT invoice_month, COUNT(*) AS count,
                COALESCE(SUM(total),0) AS total,
                COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END),0) AS paid
         FROM invoices "
        . ($fyFilter ? "WHERE financial_year = ?" : "")
        . " GROUP BY invoice_month ORDER BY invoice_month"
    );
    $stmt->execute($fyFilter ? [$fyFilter] : []);
    $monthlyReport = $stmt->fetchAll();
    foreach ($monthlyReport as &$r) {
        $r['total'] = (float)$r['total'];
        $r['paid']  = (float)$r['paid'];
        $r['count'] = (int)$r['count'];
    }

    jsonResponse(['fy_summary' => $fySummary, 'school_report' => $schoolReport, 'monthly_report' => $monthlyReport]);
}

// ─── GET list ────────────────────────────────────────────
if ($method === 'GET' && !$id) {
    $stmt = $db->query(
        "SELECT i.*, s.name AS school_name, s.district AS school_district, s.email AS school_email
         FROM invoices i JOIN schools s ON s.id = i.school_id
         ORDER BY i.created_at DESC"
    );
    jsonResponse($stmt->fetchAll());
}

// ─── GET single ──────────────────────────────────────────
if ($method === 'GET' && $id) {
    $row = getInvoiceRow($db, $id);
    if (!$row) jsonError('Not found', 404);
    jsonResponse($row);
}

// ─── POST create ─────────────────────────────────────────
if ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);

    $invoiceType  = $b['invoice_type']  ?? 'monthly';
    $invoiceMonth = $b['invoice_month'] ?? '';
    $duedays      = $invoiceType === 'monthly' ? 15 : 30;

    list($fyStr, $fyDisplay) = getFinancialYear($invoiceMonth);

    $cnt = $db->prepare("SELECT COUNT(*) FROM invoices WHERE financial_year = ?");
    $cnt->execute([$fyStr]);
    $count     = (int)$cnt->fetchColumn() + 1;
    $invNumber = "iSpark/{$fyDisplay}/" . str_pad((string)$count, 3, '0', STR_PAD_LEFT);

    $invoiceDate = $b['invoice_date'] ? new DateTime($b['invoice_date']) : new DateTime();
    $dueDate     = clone $invoiceDate;
    $dueDate->modify("+{$duedays} days");

    $students = (int)($b['students'] ?? 0);
    $rate     = (float)($b['rate']   ?? 0);
    $divisor  = (int)($b['divisor'] ?? 1);
    if ($divisor <= 0) $divisor = 1;

    $subtotal = ($students * $rate) / $divisor;
    $cgst     = round($subtotal * 0.09, 2);
    $sgst     = round($subtotal * 0.09, 2);
    $gst      = $cgst + $sgst;
    $total    = round($subtotal + $gst);

    $stmt = $db->prepare(
        "INSERT INTO invoices (invoice_number,school_id,invoice_type,invoice_date,invoice_month,financial_year,due_date,students,rate,divisor,subtotal,gst,total,status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')"
    );
    $stmt->execute([
        $invNumber, (int)$b['school'], $invoiceType,
        $invoiceDate->format('Y-m-d'), $invoiceMonth, $fyStr,
        $dueDate->format('Y-m-d'),
        $students, $rate, $divisor, $subtotal, $gst, $total,
    ]);
    $newId = $db->lastInsertId();
    $row   = getInvoiceRow($db, $newId);
    jsonResponse($row, 201);
}

// ─── PATCH status ────────────────────────────────────────
if ($method === 'PATCH' && $id) {
    $b = json_decode(file_get_contents('php://input'), true);
    if (isset($b['status'])) {
        $db->prepare("UPDATE invoices SET status = ? WHERE id = ?")->execute([$b['status'], $id]);
    }
    $row = getInvoiceRow($db, $id);
    jsonResponse($row);
}

// ─── PUT update ──────────────────────────────────────────
if ($method === 'PUT' && $id) {
    $b        = json_decode(file_get_contents('php://input'), true);
    $existing = getInvoiceRow($db, $id);
    if (!$existing) jsonError('Not found', 404);

    $invoiceType  = $b['invoice_type']  ?? $existing['invoice_type'];
    $invoiceMonth = $b['invoice_month'] ?? $existing['invoice_month'];
    $duedays      = $invoiceType === 'monthly' ? 15 : 30;

    $invoiceDate = new DateTime($b['invoice_date'] ?? $existing['invoice_date']);
    $dueDate     = clone $invoiceDate;
    $dueDate->modify("+{$duedays} days");

    $students = (int)($b['students'] ?? $existing['students']);
    $rate     = (float)($b['rate']   ?? $existing['rate']);
    $divisor  = (int)($b['divisor']  ?? $existing['divisor']);
    if ($divisor <= 0) $divisor = 1;

    $subtotal = ($students * $rate) / $divisor;
    $cgst     = round($subtotal * 0.09, 2);
    $sgst     = round($subtotal * 0.09, 2);
    $gst      = $cgst + $sgst;
    $total    = round($subtotal + $gst);

    $db->prepare(
        "UPDATE invoices SET school_id=?,invoice_type=?,invoice_date=?,invoice_month=?,
         due_date=?,students=?,rate=?,divisor=?,subtotal=?,gst=?,total=? WHERE id=?"
    )->execute([
        (int)($b['school'] ?? $existing['school_id']),
        $invoiceType,
        $invoiceDate->format('Y-m-d'),
        $invoiceMonth,
        $dueDate->format('Y-m-d'),
        $students, $rate, $divisor, $subtotal, $gst, $total,
        $id,
    ]);
    $row = getInvoiceRow($db, $id);
    jsonResponse($row);
}

// ─── DELETE ──────────────────────────────────────────────
if ($method === 'DELETE' && $id) {
    $db->prepare("DELETE FROM invoices WHERE id = ?")->execute([$id]);
    jsonResponse(['message' => 'Deleted']);
}

jsonError('Not found', 404);