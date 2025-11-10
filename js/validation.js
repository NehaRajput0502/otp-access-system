export function sanitize(str=''){
  return String(str).replace(/[<>]/g, '');
}
export function isValidEmail(email=''){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export function isValidName(name=''){
  return name.trim().length >= 2;
}
export function isValidPhone(e164 = '') {
  // Minimal E.164: +country and 6–15 digits
  return /^\+[1-9]\d{5,14}$/.test(e164);
}

