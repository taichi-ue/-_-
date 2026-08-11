const DATE_RE = /^\d{4}\/\d{2}\/\d{2}$/;
const CARD_NUMBER_RE = /^[\d\-*]+$/;

async function decodeShiftJIS(file) {
  const buffer = await file.arrayBuffer();
  const decoder = new TextDecoder('shift_jis');
  return decoder.decode(buffer);
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

function stripTrailingSpaces(value) {
  return value.replace(/[\s　]+$/g, '');
}

function isSmcHeaderRow(row) {
  if (row.length !== 3) return false;
  const name = stripTrailingSpaces(row[0]);
  return name.endsWith('様') && CARD_NUMBER_RE.test(row[1].trim());
}

function isAmexHeaderRow(row) {
  return row[0] === 'ご利用日' && row[1] === 'データ処理日';
}

function detectFormat(rows) {
  if (rows.length === 0) return null;
  const first = rows[0];
  if (isAmexHeaderRow(first)) return 'AMEX';
  if (isSmcHeaderRow(first)) return 'SMC';
  return null;
}

function parseAmount(value) {
  if (value == null) return NaN;
  const cleaned = String(value).replace(/[",\s]/g, '');
  if (cleaned === '') return NaN;
  return Number(cleaned);
}

function normalizeDate(value) {
  return value.replace(/\//g, '-');
}

function extractAmexTransactions(rows) {
  const transactions = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 6) continue;
    const date = row[0];
    const description = row[2];
    const cardHolderName = row[3] || '';
    const amount = parseAmount(row[5]);
    if (!DATE_RE.test(date) || !description || Number.isNaN(amount)) continue;
    transactions.push({
      date: normalizeDate(date),
      description,
      amount,
      cardHolderName,
    });
  }
  return transactions;
}

function extractSmcTransactions(rows) {
  const transactions = [];
  let currentHolder = '';

  for (const row of rows) {
    if (row.length === 0) continue;

    if (isSmcHeaderRow(row)) {
      currentHolder = stripTrailingSpaces(row[0]).replace(/様$/, '').trim();
      continue;
    }

    if (DATE_RE.test(row[0])) {
      const description = row[1] || '';
      const amount = parseAmount(row[2]);
      if (!description || Number.isNaN(amount)) continue;
      transactions.push({
        date: normalizeDate(row[0]),
        description,
        amount,
        cardHolderName: currentHolder,
      });
    }
  }

  return transactions;
}

async function parseCsvFile(file) {
  const text = await decodeShiftJIS(file);
  const rows = parseCsvRows(text);
  const cardType = detectFormat(rows);

  if (!cardType) {
    throw new Error('CSV形式を判定できませんでした。三井住友またはAMEXの明細CSVを選択してください。');
  }

  const transactions = cardType === 'AMEX'
    ? extractAmexTransactions(rows)
    : extractSmcTransactions(rows);

  return { cardType, transactions };
}

export {
  parseCsvFile,
  decodeShiftJIS,
  parseCsvRows,
  detectFormat,
  extractAmexTransactions,
  extractSmcTransactions,
  parseAmount,
};
