<?php
require_once __DIR__ . '/config.php';
try {
    $db = getDB();
    echo "Connection successful\n";
    $tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    echo "Tables: " . implode(", ", $tables) . "\n";
    if (in_array('schools', $tables)) {
        $count = $db->query("SELECT COUNT(*) FROM schools")->fetchColumn();
        echo "Schools count: " . $count . "\n";
    } else {
        echo "Table 'schools' DOES NOT EXIST\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
