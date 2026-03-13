<?php
require_once __DIR__ . '/config.php';
setCORSHeaders();

$id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$id) jsonError('Invoice ID required');

$db = getDB();
$stmt = $db->prepare(
    "SELECT i.*, s.name AS school_name, s.district AS school_district,
            s.address, s.state, s.pincode, s.email AS school_email
     FROM invoices i JOIN schools s ON s.id = i.school_id WHERE i.id = ?"
);
$stmt->execute([$id]);
$inv = $stmt->fetch();
if (!$inv) jsonError('Invoice not found', 404);

// ─── Calculate amounts ────────────────────────────────────
$subtotal = (float)$inv['subtotal'];
$cgst     = round($subtotal * 0.09, 2);
$sgst     = round($subtotal * 0.09, 2);
$totalVal = $subtotal + $cgst + $sgst;
$grandTotal = round($totalVal);
$roundOff   = $grandTotal - $totalVal;

// ─── Invoice month label ──────────────────────────────────
if ($inv['invoice_month']) {
    $dt         = new DateTime($inv['invoice_month'] . '-01');
    $monthLabel = $dt->format('F Y');
} else {
    $dt         = new DateTime($inv['invoice_date']);
    $monthLabel = $dt->format('F Y');
}

$invType  = $inv['invoice_type'] === 'monthly' ? 'Monthly' : 'Quarterly';
$students = (int)$inv['students'];
$rate     = (float)$inv['rate'];
$divisor  = (int)($inv['divisor'] ?: 1);

// ─── Images as base64 ─────────────────────────────────────
$logoImg      = imageToBase64('iSpark.png');
$watermarkImg = imageToBase64('watermark.jpg');
$headerImg    = imageToBase64('header.jpg');
$footerImg    = imageToBase64('footer.jpg');
$signatureImg = imageToBase64('signature.png');

$words = amountInWords($grandTotal);
$invDateFmt = (new DateTime($inv['invoice_date']))->format('d-m-Y');

header('Content-Type: text/html; charset=utf-8');
header('X-Frame-Options: SAMEORIGIN');
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Invoice <?= htmlspecialchars($inv['invoice_number']) ?></title>
<style>
  @media print {
    body { background: none; }
    .no-print { display: none !important; }
    .page { margin: 0; box-shadow: none; border: none; }
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12pt; color: #333; background:#f0f2f5; }
  .page { 
    width:210mm; height:297mm; background:#fff; margin:20px auto; 
    position:relative; overflow:hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); border: 1px solid #ddd;
    display: flex; flex-direction: column;
  }
  .watermark {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    background-image: url("<?= $watermarkImg ?>");
    background-size: 100%; 
    background-repeat: no-repeat; background-position: center;
    opacity: 0.35; z-index: 0; pointer-events: none;
  }
  .content { padding: 30px 45px; position: relative; z-index: 1; flex: 1; }
  
  .logo-section { text-align: center; margin-bottom: 5px; }
  .logo-section img { height: 60px; }
  
  .header-divider { 
    display: flex; height: 4px; margin: 15px 0; width: 100%;
  }
  .divider-orange { background: #f39c12; flex: 1; }
  .divider-black { background: #000; flex: 1; }
  
  .invoice-header { text-align: center; margin-bottom: 20px; }
  .invoice-header h1 { font-size: 18pt; letter-spacing: 2px; color: #000; font-weight: 700; margin-bottom: 2px;}
  .original-recipient { font-size: 10pt; color: #666; font-weight: normal; display: block; margin-top: -5px; }
  
  .meta-grid { 
    display: flex; justify-content: space-between; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000;
    padding: 10px 0; margin-bottom: 20px; font-size: 12pt;
  }
  .meta-left { width: 50%; }
  .meta-right { width: 45%; text-align: right; }
  
  .address-section { display: flex; justify-content: space-between; margin-bottom: 25px; gap: 20px; }
  .address-box { width: 48%; }
  .address-label { color: #000; font-weight: bold; font-size: 11pt; margin-bottom: 4px; 
    /* border-bottom: 1px solid #000;  */
    display: inline-block; width: 100%;}
  .company-name { font-weight: 600; font-size: 12.2pt; color: #00008B; margin-top: 5px; }
  .address-text { font-size: 10.5pt; color: #000; line-height: 1.4; }
  
  .main-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 2px solid #000; }
  .main-table th { background: #bdbdbdff; color: #000000ff; border: 1px solid #000; padding: 12px 8px; font-weight: 500; text-align: center; font-size: 12pt; }
  .main-table td { border: 1.5px solid #000; padding: 8px 8px; vertical-align: middle; font-size: 10.5pt; color: #000; }
  
  .totals-row td { font-weight: 600; }
  .total-display-row { background: #f8fafc; color: #000 !important; font-size: 12pt; }
  .total-display-row td { border-top: 2px solid #000 !important; }
  
  .amount-words { font-weight: bold; margin-bottom: 25px; font-size: 10.5pt; color: #000;}
  
  .bottom-grid { display: flex; justify-content: space-between; margin-top: 10px; }
  .payment-details { width: 55%; }
  .payment-details-table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
  .payment-details-table td { border: 1.5px solid #000; padding: 6px 12px; font-size: 12pt; color: #000; }
  .payment-details-table td:first-child { font-weight: 600; background: #fff; color: #00008B; width: 40%; }
  
  .signature-section { width: 40%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
  .signature-label { font-weight: bold; margin-bottom: 5px; color: #00008B; }
  .signature-box { position: relative; width: 100%; min-height: 60px; display: flex; align-items: center; justify-content: center; }
  .signature-box img { 
    height: 75px; 
    mix-blend-mode: multiply; 
    margin: -10px 0;
  }
  .signatory-name { font-weight: bold; font-size: 12pt; margin-top: 5px; border-top: 2px solid #000; padding-top: 5px; display: inline-block; width: 80%; }
  .signatory-title { font-size: 10.5pt; color: #64748b; }
  
  .footer-img-wrap { width: 100%; margin-top: auto; }
  .footer-img-wrap img { width: 100%; display: block; }
  
  .no-print { position:fixed; top:15px; right:15px; z-index:1000; display: flex; gap: 10px; }
  .no-print button { 
    padding:10px 18px; border-radius:8px; border:none; cursor:pointer; 
    font-weight:600; display:flex; align-items:center; gap:6px; background:#00008B; color:#fff;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
  .no-print button:hover { opacity: 0.9; }
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">Print Invoice</button>
  <button onclick="window.close()" style="background:#64748b;">Close</button>
</div>
<div class="page">
  <div class="watermark"></div>
  
  <div class="content">
    <div class="logo-section">
      <img src="<?= $logoImg ?>" alt="iSpark Logo"/>
    </div>
    
    <div class="header-divider">
      <div class="divider-black"></div>
      <div class="divider-orange"></div>
    </div>
    
    <div class="invoice-header">
      <h1>TAX INVOICE</h1>
      <span class="original-recipient">Original for Recipient</span>
    </div>

    <div class="meta-grid">
      <div class="meta-left">
        <div><b>Invoice No :</b> <?= htmlspecialchars($inv['invoice_number']) ?></div>
        <div><b>Invoice Date :</b> <?= $invDateFmt ?></div>
      </div>
      <div class="meta-right">
        <div><b>GSTIN :</b> 33AAFCI5350R1Z6</div>
      </div>
    </div>

    <div class="address-section">
      <div class="address-box">
        <div class="address-label">From:</div>
        <div class="company-name">iSpark Learning Solutions Private Limited</div>
        <div class="address-text">
          No.53/10, Soundarya Colony, Anna Nagar West Extn., Chennai - 600101
        </div>
      </div>
      <div class="address-box">
        <div class="address-label">Bill To:</div>
        <div class="company-name"><?= htmlspecialchars($inv['school_name']) ?></div>
        <div class="address-text">
          <?= htmlspecialchars($inv['address']) ?>,<br/>
          <?= htmlspecialchars($inv['school_district']) ?>, <?= htmlspecialchars($inv['state']) ?> - <?= htmlspecialchars($inv['pincode']) ?>.
        </div>
      </div>
    </div>

    <table class="main-table">
      <thead>
        <tr>
          <th width="8%">S.No</th>
          <th width="50%">Description</th>
          <th width="17%">HSN</th>
          <th width="25%">Amount in INR</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td align="center">1.</td>
          <td>
            <b>STEM Training Services for the month of <?= $monthLabel ?></b>.<br/>
            (<?= $students ?> Students X <?= number_format($rate, 0) ?>)/<?= $divisor ?> months
          </td>
          <td align="center">90318000</td>
          <td align="right"><?= number_format($subtotal, 2) ?></td>
        </tr>
        <tr>
          <td align="center">2.</td>
          <td align="right" style="padding-right: 20px;">CGST @ 9%</td>
          <td align="center"></td>
          <td align="right"><?= number_format($cgst, 2) ?></td>
        </tr>
        <tr>
          <td align="center">3.</td>
          <td align="right" style="padding-right: 20px;">SGST @ 9%</td>
          <td align="center"></td>
          <td align="right"><?= number_format($sgst, 2) ?></td>
        </tr>
        <tr class="totals-row">
          <td align="center"></td>
          <td align="right" style="padding-right: 20px;">Round off</td>
          <td align="center"></td>
          <td align="right"><?= ($roundOff >= 0 ? '+' : '') . number_format($roundOff, 2) ?></td>
        </tr>
        <tr class="totals-row total-display-row">
          <td align="center"></td>
          <td align="right" style="padding-right: 20px; font-size: 12pt;">Total</td>
          <td align="center"></td>
          <td align="right" style="font-size: 12pt;"><?= number_format($grandTotal, 2) ?></td>
        </tr>
      </tbody>
    </table>

    <div class="amount-words">
      (<?= htmlspecialchars($words) ?>)
    </div>

    <div class="bottom-grid">
      <div class="payment-details">
        <div style="font-weight:bold; margin-bottom:5px; color: #1a3a5c;">Bank / Payment Details</div>
        <table class="payment-details-table">
          <tr><td>Company Name</td><td>iSpark Learning Solutions Private Limited</td></tr>
          <tr><td>Bank Name</td><td>HDFC Bank Ltd</td></tr>
          <tr><td>Account No</td><td>50200047703232</td></tr>
          <tr><td>IFSC Code</td><td>HDFC0001989</td></tr>
        </table>
      </div>

      <div class="signature-section">
        <div class="signature-label">Authorized Signatory</div>
        <div class="signature-box">
          <?php if ($signatureImg): ?>
            <img src="<?= $signatureImg ?>" alt="Signature"/>
          <?php endif; ?>
        </div>
        <div class="signatory-name">(P H Mohanamurthy)</div>
        <div class="signatory-title">Director & CEO</div>
      </div>
    </div>
  </div>

  <?php if ($footerImg): ?>
  <div class="footer-img-wrap">
    <img src="<?= $footerImg ?>" alt="Footer Contact Details"/>
  </div>
  <?php endif; ?>
</div>
</body>
</html>
