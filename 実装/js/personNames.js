import { getAll, putRecord } from './db.js';

const DEFAULT_PERSON_NAMES = { A: 'A', B: 'B' };

async function getPersonNames() {
  const settings = await getAll('settings');
  const a = settings.find((s) => s.key === 'personNameA');
  const b = settings.find((s) => s.key === 'personNameB');
  return {
    A: (a && a.value) || DEFAULT_PERSON_NAMES.A,
    B: (b && b.value) || DEFAULT_PERSON_NAMES.B,
  };
}

async function setPersonNames(names) {
  await putRecord('settings', { key: 'personNameA', value: names.A || DEFAULT_PERSON_NAMES.A });
  await putRecord('settings', { key: 'personNameB', value: names.B || DEFAULT_PERSON_NAMES.B });
}

export { getPersonNames, setPersonNames, DEFAULT_PERSON_NAMES };
