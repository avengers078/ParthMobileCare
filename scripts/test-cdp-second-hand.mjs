import fs from 'node:fs';

const ARTIFACT_DIR = '/Users/chetan/.gemini/antigravity/brain/1e8db0dc-5b10-434a-9582-7599c3da8ee8';
const WORKSPACE_DIR = '/Users/chetan/ParthMobileCare';

async function getPageWsUrl() {
  const res = await fetch('http://127.0.0.1:9222/json/list');
  const pages = await res.json();
  const page = pages.find((p) => p.type === 'page' && p.url.includes('localhost:3000'));
  if (!page) throw new Error('No dashboard page found on port 9222');
  return page.webSocketDebuggerUrl;
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      const cb = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) cb.reject(new Error(msg.error.message));
      else cb.resolve(msg.result);
    }
  };

  const readyPromise = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const send = async (method, params = {}) => {
    await readyPromise;
    id++;
    const currentId = id;
    return new Promise((resolve, reject) => {
      callbacks.set(currentId, { resolve, reject });
      ws.send(JSON.stringify({ id: currentId, method, params }));
    });
  };

  const evaluate = async (expression, awaitPromise = false) => {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
    });
    return res.result?.value;
  };

  const captureScreenshot = async (filepath) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filepath, buffer);
  };

  const close = () => ws.close();

  return { send, evaluate, captureScreenshot, close, readyPromise };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  console.log('Connecting to Chrome DevTools Protocol...');
  const wsUrl = await getPageWsUrl();
  const cdp = createCdpClient(wsUrl);
  await cdp.readyPromise;
  console.log('Connected to CDP.');

  // Set window size for crisp desktop screenshots
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 2,
    mobile: false,
  });

  // 1. Authenticate Admin Session
  console.log('1. Setting Admin Session...');
  await cdp.evaluate(`
    window.__DEV_SET_ADMIN__({
      id: '8X4u2Tidn4RSdnQA4dAKt41Ji7a2',
      email: 'parthmobilecare07@gmail.com',
      name: 'Parth Patel',
      role: 'admin',
      isActive: true
    });
  `);
  await sleep(1000);

  // 2. Navigate to Second-Hand tab
  console.log('2. Navigating to Second-Hand section...');
  await cdp.evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Second-Hand Devices'));
      if (btn) btn.click();
    })()
  `);
  await sleep(2500);

  // 3. Verify Buy (Purchase) Record in Table
  console.log('3. Inspecting In-Stock & Purchase Records...');
  const buyTableInfo = await cdp.evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const foundRow = rows.find(r => r.innerText.includes('869402918475610') || r.innerText.includes('Bhavin Shah') || r.innerText.includes('OnePlus 12'));
      if (!foundRow) return null;
      return {
        rowText: foundRow.innerText,
        cells: Array.from(foundRow.querySelectorAll('td')).map(c => c.innerText.trim())
      };
    })()
  `);

  console.log('Found Buy Record Row:', JSON.stringify(buyTableInfo, null, 2));
  if (!buyTableInfo) {
    throw new Error('Test Buy record not found in purchases table!');
  }

  // 4. Open Purchase Details Modal
  console.log('4. Opening Purchase Details Modal...');
  await cdp.evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const foundRow = rows.find(r => r.innerText.includes('869402918475610') || r.innerText.includes('Bhavin Shah') || r.innerText.includes('OnePlus 12'));
      if (foundRow) {
        const eyeBtn = foundRow.querySelectorAll('button')[0];
        if (eyeBtn) eyeBtn.click();
      }
    })()
  `);
  await sleep(1500);

  // Inspect modal content & Cloudinary photos
  const modalInfo = await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-0');
      if (!modal) return null;
      const images = Array.from(modal.querySelectorAll('img')).map(i => i.src);
      const links = Array.from(modal.querySelectorAll('a')).map(a => a.href);
      return {
        text: modal.innerText,
        images,
        links
      };
    })()
  `);

  console.log('\n--- BUY MODAL VERIFICATION EVIDENCE ---');
  console.log('Modal Text Snippet:\n', modalInfo?.text);
  console.log('Inspection Photo Image Sources:', modalInfo?.images);
  console.log('Modal Links (CDN / Bill):', modalInfo?.links);

  // Save screenshot of Buy Details Modal
  const buyScreenshotWorkspace = `${WORKSPACE_DIR}/admin_dashboard_buy_verification.png`;
  const buyScreenshotArtifact = `${ARTIFACT_DIR}/admin_dashboard_buy_verification.png`;
  console.log('Capturing Buy Modal Screenshot...');
  await cdp.captureScreenshot(buyScreenshotWorkspace);
  fs.copyFileSync(buyScreenshotWorkspace, buyScreenshotArtifact);
  console.log(`✓ Buy Screenshot saved to ${buyScreenshotWorkspace}`);

  // Close Buy modal
  await cdp.evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText === '✕' || b.innerHTML.includes('lucide-x') || b.querySelector('svg.lucide-x'));
      if (closeBtn) closeBtn.click();
      else {
        // click backdrop or escape
        const back = document.querySelector('.fixed.inset-0.bg-black\\\\/50, .fixed.inset-0.bg-black\\\\/60');
        if (back) back.click();
      }
    })()
  `);
  await sleep(1000);

  // 5. Switch to Sales Tab
  console.log('\n5. Switching to Sale Invoices & Tax Receipts tab...');
  await cdp.evaluate(`
    (() => {
      const salesTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sale Invoices & Tax Receipts'));
      if (salesTabBtn) salesTabBtn.click();
    })()
  `);
  await sleep(2000);

  // Inspect Sell Table Row
  const sellTableInfo = await cdp.evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const foundRow = rows.find(r => r.innerText.includes('PMC-INV-20261122-0099') || r.innerText.includes('Karan Malhotra') || r.innerText.includes('359876543210985'));
      if (!foundRow) return null;
      return {
        rowText: foundRow.innerText,
        cells: Array.from(foundRow.querySelectorAll('td')).map(c => c.innerText.trim())
      };
    })()
  `);

  console.log('Found Sell Record Row:', JSON.stringify(sellTableInfo, null, 2));
  if (!sellTableInfo) {
    throw new Error('Test Sell record not found in sales table!');
  }

  // 6. Open Sale Details Modal
  console.log('6. Opening Sale Details / Tax Invoice Modal...');
  await cdp.evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const foundRow = rows.find(r => r.innerText.includes('PMC-INV-20261122-0099') || r.innerText.includes('Karan Malhotra'));
      if (foundRow) {
        const buttons = Array.from(foundRow.querySelectorAll('button'));
        // The second action button is "View Sale Details" (eye icon)
        const eyeBtn = buttons.find(b => b.title?.includes('View Sale') || b.getAttribute('aria-label')?.includes('View Sale')) || buttons[buttons.length - 1];
        if (eyeBtn) eyeBtn.click();
      }
    })()
  `);
  await sleep(1500);

  const saleModalInfo = await cdp.evaluate(`
    (() => {
      const modal = document.querySelector('[role="dialog"]') || document.querySelector('.fixed.inset-0');
      if (!modal) return null;
      return {
        text: modal.innerText
      };
    })()
  `);

  console.log('\n--- SALE MODAL VERIFICATION EVIDENCE ---');
  console.log('Sale Invoice Text Snippet:\n', saleModalInfo?.text);

  // Save screenshot of Sale Invoice Modal
  const saleScreenshotWorkspace = `${WORKSPACE_DIR}/admin_dashboard_sell_verification.png`;
  const saleScreenshotArtifact = `${ARTIFACT_DIR}/admin_dashboard_sell_verification.png`;
  console.log('Capturing Sale Invoice Screenshot...');
  await cdp.captureScreenshot(saleScreenshotWorkspace);
  fs.copyFileSync(saleScreenshotWorkspace, saleScreenshotArtifact);
  console.log(`✓ Sale Screenshot saved to ${saleScreenshotWorkspace}`);

  // Close Sale modal
  await cdp.evaluate(`
    (() => {
      const closeBtn = document.querySelector('button[aria-label="Close"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText === '✕' || b.innerHTML.includes('lucide-x') || b.querySelector('svg.lucide-x'));
      if (closeBtn) closeBtn.click();
    })()
  `);
  await sleep(1000);

  // 7. Test Refresh Persistence
  console.log('\n7. Testing Refresh Persistence (Page Reload)...');
  await cdp.evaluate(`window.location.reload()`);
  await sleep(2500);

  // Re-set admin session after reload
  await cdp.evaluate(`
    window.__DEV_SET_ADMIN__({
      id: '8X4u2Tidn4RSdnQA4dAKt41Ji7a2',
      email: 'parthmobilecare07@gmail.com',
      name: 'Parth Patel',
      role: 'admin',
      isActive: true
    });
  `);
  await sleep(1000);

  // Navigate back to Second Hand
  await cdp.evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll('button, a')).find(el => el.innerText.includes('Second-Hand Devices'));
      if (btn) btn.click();
    })()
  `);
  await sleep(2000);

  const postRefreshBuy = await cdp.evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.some(r => r.innerText.includes('869402918475610') || r.innerText.includes('Bhavin Shah'));
    })()
  `);

  await cdp.evaluate(`
    (() => {
      const salesTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Sale Invoices & Tax Receipts'));
      if (salesTabBtn) salesTabBtn.click();
    })()
  `);
  await sleep(1500);

  const postRefreshSale = await cdp.evaluate(`
    (() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.some(r => r.innerText.includes('PMC-INV-20261122-0099') || r.innerText.includes('Karan Malhotra'));
    })()
  `);

  console.log(`Post-Refresh Buy Record Visible: ${postRefreshBuy}`);
  console.log(`Post-Refresh Sale Record Visible: ${postRefreshSale}`);

  if (!postRefreshBuy || !postRefreshSale) {
    throw new Error('Records failed to persist across page refresh!');
  }

  cdp.close();
  console.log('\n================================================================');
  console.log('✓ ALL END-TO-END VERIFICATIONS PASSED WITH ACTUAL UI EVIDENCE');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('\nVERIFICATION RUN FAILED:', err);
  process.exit(1);
});
