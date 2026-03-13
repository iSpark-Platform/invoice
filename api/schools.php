<?php
require_once __DIR__ . '/config.php';
setCORSHeaders();

validateToken();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$db     = getDB();

// ── GET list ──
if ($method === 'GET' && !$id) {
    $stmt = $db->query("SELECT * FROM schools ORDER BY name");
    jsonResponse($stmt->fetchAll());
}

// ── GET single ──
if ($method === 'GET' && $id) {
    $stmt = $db->prepare("SELECT * FROM schools WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) jsonError('Not found', 404);
    jsonResponse($row);
}

// ── POST create ──
if ($method === 'POST') {
    $b = json_decode(file_get_contents('php://input'), true);
    foreach (['name','contact','email','phone'] as $f) {
        if (empty($b[$f])) jsonError("Field '$f' is required");
    }
    $stmt = $db->prepare(
        "INSERT INTO schools (name,contact,email,phone,students,address,district,state,pincode,status)
         VALUES (?,?,?,?,?,?,?,?,?,?)"
    );
    try {
        $stmt->execute([
            $b['name'], $b['contact'], $b['email'], $b['phone'],
            (int)($b['students'] ?? 0),
            $b['address']  ?? '',
            $b['district'] ?? '',
            $b['state']    ?? '',
            $b['pincode']  ?? '',
            $b['status']   ?? 'Active',
        ]);
        $newId = $db->lastInsertId();
        $s = $db->prepare("SELECT * FROM schools WHERE id = ?");
        $s->execute([$newId]);
        jsonResponse($s->fetch(), 201);
    } catch (PDOException $e) {
        jsonError('Email already exists');
    }
}

// ── PUT update ──
if ($method === 'PUT' && $id) {
    $b = json_decode(file_get_contents('php://input'), true);
    $stmt = $db->prepare(
        "UPDATE schools SET name=?,contact=?,email=?,phone=?,students=?,
         address=?,district=?,state=?,pincode=?,status=? WHERE id=?"
    );
    try {
        $stmt->execute([
            $b['name'], $b['contact'], $b['email'], $b['phone'],
            (int)($b['students'] ?? 0),
            $b['address']  ?? '',
            $b['district'] ?? '',
            $b['state']    ?? '',
            $b['pincode']  ?? '',
            $b['status']   ?? 'Active',
            $id,
        ]);
        $s = $db->prepare("SELECT * FROM schools WHERE id = ?");
        $s->execute([$id]);
        jsonResponse($s->fetch());
    } catch (PDOException $e) {
        jsonError('Email already exists');
    }
}

// ── DELETE ──
if ($method === 'DELETE' && $id) {
    $db->prepare("DELETE FROM schools WHERE id = ?")->execute([$id]);
    jsonResponse(['message' => 'Deleted']);
}

jsonError('Not found', 404);
