// اختبار بسيط
console.log('i18n.js loaded successfully');
export const t = (key) => key;
export const getLanguage = () => 'en';
export const setLanguage = (lang) => { localStorage.setItem('lang', lang); };
export const getActionTypeTranslation = (type) => type;