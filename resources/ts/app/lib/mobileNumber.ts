export const MOBILE_LOCAL_LENGTH = 10;
export const MOBILE_PREFIX = '+63';

export function localMobileNumber(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('63')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, MOBILE_LOCAL_LENGTH);
}

export function formatMobileNumber(digits: string) {
  return digits ? MOBILE_PREFIX + digits : '';
}

export function isPhilippineMobileNumber(value: string) {
  return /^(?:\+?63|0)?9\d{9}$/.test(value.replace(/[\s()-]/g, ''));
}
