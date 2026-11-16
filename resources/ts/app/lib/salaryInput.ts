export function formatSalaryInput(value: string) {
  return value.replace(/,/g, '').replace(/\d+(?:\.\d*)?/g, number => {
    const [whole, fraction] = number.split('.');
    const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
  });
}

export function parseDailyRateInput(value: string) {
  const amount = value.trim().replace(/^₱\s*/, '');
  if (!amount) return '';
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?$/.test(amount)
    ? amount.replace(/,/g, '')
    : null;
}

export function readDailyRateEdit(input: HTMLInputElement, inputType?: string, maxWholeDigits?: number) {
  const rate = parseDailyRateInput(inputType === 'insertFromPaste' ? input.value : input.value.replace(/,/g, ''));
  if (rate === null || (maxWholeDigits !== undefined && rate.split('.')[0].length > maxWholeDigits)) return null;

  const beforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/[₱,\s]/g, '').length;
  const formatted = formatSalaryInput(rate);
  let caret = 0;
  let characters = 0;
  while (caret < formatted.length && characters < beforeCaret) {
    if (formatted[caret] !== ',') characters++;
    caret++;
  }
  if (inputType === 'deleteContentForward' && formatted[caret] === ',') caret++;

  requestAnimationFrame(() => {
    if (input === document.activeElement && input.value === formatted) input.setSelectionRange(caret, caret);
  });
  return rate;
}
