import { getAll, putRecord } from './db.js';

const FULLWIDTH_ALNUM_RE = /[０-９Ａ-Ｚａ-ｚ]/g;

function normalize(str) {
  if (!str) return '';
  return str
    .replace(FULLWIDTH_ALNUM_RE, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

function applyRules(transaction, rules) {
  const target = normalize(transaction.description);
  const sorted = rules
    .filter((r) => r.enabled)
    .sort((a, b) => (a.priority - b.priority) || (a.id - b.id));

  for (const rule of sorted) {
    if (target.includes(normalize(rule.keyword))) {
      return { category: rule.category, matchedRuleId: rule.id, isAuto: true };
    }
  }

  return { category: null, matchedRuleId: null, isAuto: false };
}

async function reapplyToUnassigned() {
  const rules = await getAll('rules');
  const allTransactions = await getAll('transactions');
  const unassigned = allTransactions.filter((t) => t.category === null);
  let count = 0;

  for (const tx of unassigned) {
    const result = applyRules(tx, rules);
    if (result.category) {
      await putRecord('transactions', {
        ...tx,
        category: result.category,
        isAuto: true,
        matchedRuleId: result.matchedRuleId,
      });
      count++;
    }
  }

  return count;
}

export { normalize, applyRules, reapplyToUnassigned };
