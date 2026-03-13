<?php
require_once __DIR__ . '/config.php';
setCORSHeaders();

validateToken();

$id     = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') jsonError('Method not allowed', 405);
if (!$id) jsonError('Invoice ID required');

$db   = getDB();
$stmt = $db->prepare(
    "SELECT i.*, s.name AS school_name, s.district AS school_district,
            s.address, s.state, s.pincode, s.email AS school_email
     FROM invoices i JOIN schools s ON s.id = i.school_id WHERE i.id = ?"
);
$stmt->execute([$id]);
$inv = $stmt->fetch();
if (!$inv) jsonError('Invoice not found', 404);

$body     = json_decode(file_get_contents('php://input'), true);
$toEmail  = $body['to_email']  ?? $inv['school_email'];
$ccEmail  = $body['cc_email']  ?? '';
$bccEmail = $body['bcc_email'] ?? '';
$subject  = $body['subject']   ?? '';

// Invoice month label
if ($inv['invoice_month']) {
    $dt         = new DateTime($inv['invoice_month'] . '-01');
    $monthLabel = $dt->format('F Y');
} else {
    $dt         = new DateTime($inv['invoice_date']);
    $monthLabel = $dt->format('F Y');
}

$actualPdfUrl = BASE_URL . "/ispark_invoice/api/invoice_pdf.php?id={$id}";

// ─── Build HTML email body ────────────────────────────────
$htmlBody = <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">
<style>
  body { font-family: Arial, sans-serif; font-size: 14px; color: #334155; margin:0; padding:0; line-height: 1.6; }
  .container { max-width: 1000px; margin: 20px auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
  .header { background: darkblue; color: #ffffff; padding: 18px; text-align: center; }
  .content { padding: 32px; background: #ffffff; }
  .btn-box { text-align: center; margin: 32px 0; }
  .btn { background: darkblue; color: #ffffff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 400; display: inline-block; }
  .footer { background: #f8fafc; padding: 24px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
  .sig { margin-top: 32px; padding-top: 24px; border-top: 1px solid #f1f5f9; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
   <h2 style="margin:0; font-weight:500">Invoice: {$inv['invoice_number']}</h2>
  </div>
  <div class="content">
    <p>Dear Principal,</p>
<p>Greetings from iSpark Learning Solutions Pvt Ltd!</p>
<p>Please find attached the invoice for our services rendered in {$monthLabel}. We kindly request that you settle the payment at your earliest convenience, using the bank account details mentioned in the invoice.</p>
<p>If you require any further information or clarification, please don't hesitate to reach out. We appreciate your continued support and look forward to a long-term partnership.</p>
    <!-- <p>Greetings from <strong>iSpark Learning Solutions</strong>!</p>
    <p>Please find the invoice for our services rendered in <span style="color:#1640ff; font-weight:bold;">{$monthLabel}</span>.</p> -->
    
    <div class="btn-box">
      <a href="{$actualPdfUrl}" class="btn">View & Download Invoice PDF</a>
    </div>

    <p style="font-size:13px; color:#64748b;">
      If the button above doesn't work, copy and paste this link into your browser:<br/>
      <small>{$actualPdfUrl}</small>
    </p>

    <div class="sig">
      <p style="margin:0"><strong>THANKS & REGARDS,</strong></p>
      <p style="margin:4px 0"><strong>RAMAKRISHNAN G</strong><br/><small>Accounts Manager</small></p>
      <p style="margin:0; font-size:13px;">iSpark Learning Solutions Private Limited</p>
    </div>
  </div>
  <!-- <div class="footer">
    This is an automated message from iSpark Invoice System.
  </div> -->
</div>
</body>
</html>
HTML;

require_once __DIR__ . '/SmtpClient.php';

$sent = false;
$error = '';

try {
    $smtp = new SmtpClient(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_FROM_NAME);
    $sent = $smtp->send($toEmail, $subject, $htmlBody, $ccEmail, $bccEmail);
} catch (Exception $e) {
    $error = $e->getMessage();
}

if ($sent) {
    $db->prepare("UPDATE invoices SET status='sent' WHERE id=?")->execute([$id]);
    jsonResponse(['success' => true, 'message' => 'Email sent successfully!']);
} else {
    jsonResponse(['error' => $error ?: 'Failed to send email'], 500);
}
