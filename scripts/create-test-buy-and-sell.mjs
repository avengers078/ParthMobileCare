#!/usr/bin/env node
/**
 * Create Real Test Buy and Sell Entries in Production Firestore
 * Project: parthmobilecare-a474d
 */

import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';

const PROJECT_ID = 'parthmobilecare-a474d';

function getCliAccessToken() {
  const configPath = `${os.homedir()}/.config/configstore/firebase-tools.json`;
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return cfg.tokens.access_token;
}

function httpsRequest({ hostname, path, method = 'GET', data = null, token }) {
  return new Promise((resolve, reject) => {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    if (data) {
      headers['Content-Type'] = 'application/json';
    }
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body), raw: body });
          } catch {
            resolve({ statusCode: res.statusCode, data: null, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      fields[k] = { nullValue: null };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (typeof v === 'number') {
      if (Number.isInteger(v)) {
        fields[k] = { integerValue: v.toString() };
      } else {
        fields[k] = { doubleValue: v };
      }
    } else if (typeof v === 'string') {
      fields[k] = { stringValue: v };
    } else if (Array.isArray(v)) {
      fields[k] = {
        arrayValue: {
          values: v.map((item) => ({ stringValue: String(item) })),
        },
      };
    }
  }
  return { fields };
}

async function createFirestoreDoc(token, collectionPath, docId, data) {
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}?documentId=${docId}`,
    method: 'POST',
    data: toFirestoreFields(data),
    token,
  });

  if (res.statusCode !== 200 && res.statusCode !== 201) {
    throw new Error(`Failed to create ${collectionPath}/${docId} (${res.statusCode}): ${res.raw}`);
  }
  return res.data;
}

async function main() {
  console.log('--- Creating Real Test Buy and Sell Entries ---');
  const token = getCliAccessToken();

  const timestamp = Date.now();
  const today = '2026-11-22';
  const nowTime = '23:15:00';

  // 1. Create Real Buy Entry (SecondHandPurchase)
  const buyId = `pur_${timestamp}_test`;
  const buyImei = `869402918475610`;

  // Schema matches isValidSecondHandPurchase(data)
  const buyParentDoc = {
    id: buyId,
    brand: 'OnePlus',
    model: 'OnePlus 12 16/512GB Silky Black',
    ram: '16GB',
    storage: '512GB',
    imei: buyImei,
    condition: 'Like New with Box & Accessories',
    purchaseAmount: 45000,
    purchaseDate: today,
    purchaseTime: nowTime,
    purchasedByStaffId: '8X4u2Tidn4RSdnQA4dAKt41Ji7a2',
    purchasedByStaffName: 'Parth Patel',
    status: 'in_stock',
    notes: 'Pre-APK Acceptance Test Buy Entry',
    hasSensitiveKyc: true,
    _syncedAt: new Date().toISOString(),
  };

  console.log(`Writing Buy Parent Document: second_hand_purchases/${buyId} ...`);
  await createFirestoreDoc(token, 'second_hand_purchases', buyId, buyParentDoc);
  console.log(`✓ Created: second_hand_purchases/${buyId}`);

  // Sensitive KYC in subcollection kyc_sensitive/record
  const inspectionPhotos = [
    'https://res.cloudinary.com/lbqtrrw5/image/upload/v1795350806/parth_mobile_care/devices/gyvtzzr47vdyjyzjgnpg.jpg',
  ];
  const billImage = 'https://res.cloudinary.com/lbqtrrw5/image/upload/v1795350808/parth_mobile_care/leads/puu9rsfcblqy46gbvirb.png';

  const buyKycDoc = {
    id: 'record',
    purchaseId: buyId,
    customerName: 'Bhavin Shah',
    phone: '9825198251',
    alternatePhone: '9825198252',
    address: 'Shop 12, Ring Road Market, Surat',
    aadhaarNumber: 'XXXX-XXXX-4921',
    customerPhotoUri: JSON.stringify(inspectionPhotos),
    billImageUri: billImage,
    digitalSignatureUri: 'M 100 100 L 120 80 L 140 110 L 160 90',
    recordedByStaffId: '8X4u2Tidn4RSdnQA4dAKt41Ji7a2',
    recordedByStaffName: 'Parth Patel',
    createdAt: new Date().toISOString(),
    _syncedAt: new Date().toISOString(),
  };

  console.log(`Writing Buy KYC Document: second_hand_purchases/${buyId}/kyc_sensitive/record ...`);
  await createFirestoreDoc(token, `second_hand_purchases/${buyId}/kyc_sensitive`, 'record', buyKycDoc);
  console.log(`✓ Created: second_hand_purchases/${buyId}/kyc_sensitive/record`);

  // 2. Create Real Sell Entry (SecondHandSale)
  const saleId = `sale_${timestamp}_test`;
  const saleInvoice = `PMC-INV-20261122-0099`;

  const saleParentDoc = {
    id: saleId,
    purchaseRecordId: buyId,
    buyerName: 'Karan Malhotra',
    phone: '9876543210',
    address: 'Flat 402, Green Avenue, Vesu, Surat',
    brand: 'Apple',
    model: 'iPhone 15 Pro 128GB Blue Titanium',
    ram: '8GB',
    storage: '128GB',
    imei: '359876543210985',
    sellingAmount: 61000,
    purchaseAmount: 52000,
    profitAmount: 9000,
    marginPercent: 17.3,
    invoiceNumber: saleInvoice,
    digitalSignatureUri: 'M 50 80 L 80 50 L 110 80 L 140 60',
    saleDate: today,
    saleTime: '23:20:00',
    soldByStaffId: '8X4u2Tidn4RSdnQA4dAKt41Ji7a2',
    soldByStaffName: 'Parth Patel',
    paymentMethod: 'UPI',
    warrantyMonths: 6,
    notes: 'Pre-APK Acceptance Test Sale Entry',
    hasSensitiveKyc: true,
    _syncedAt: new Date().toISOString(),
  };

  console.log(`Writing Sale Parent Document: second_hand_sales/${saleId} ...`);
  await createFirestoreDoc(token, 'second_hand_sales', saleId, saleParentDoc);
  console.log(`✓ Created: second_hand_sales/${saleId}`);

  // Sensitive Sale KYC
  const saleKycDoc = {
    id: 'record',
    saleId: saleId,
    buyerName: 'Karan Malhotra',
    phone: '9876543210',
    alternatePhone: '9876543211',
    address: 'Flat 402, Green Avenue, Vesu, Surat',
    aadhaarNumber: 'XXXX-XXXX-8832',
    digitalSignatureUri: 'M 50 80 L 80 50 L 110 80 L 140 60',
    recordedByStaffId: '8X4u2Tidn4RSdnQA4dAKt41Ji7a2',
    recordedByStaffName: 'Parth Patel',
    createdAt: new Date().toISOString(),
    _syncedAt: new Date().toISOString(),
  };

  console.log(`Writing Sale KYC Document: second_hand_sales/${saleId}/kyc_sensitive/record ...`);
  await createFirestoreDoc(token, `second_hand_sales/${saleId}/kyc_sensitive`, 'record', saleKycDoc);
  console.log(`✓ Created: second_hand_sales/${saleId}/kyc_sensitive/record`);

  console.log('\n--- SUCCESS ---');
  console.log(`Buy Record ID: ${buyId}`);
  console.log(`Buy IMEI: ${buyImei}`);
  console.log(`Sale Record ID: ${saleId}`);
  console.log(`Sale Invoice: ${saleInvoice}`);
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
