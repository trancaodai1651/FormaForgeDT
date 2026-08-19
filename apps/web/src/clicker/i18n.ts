export type ClickerLanguage = 'en' | 'vi';

let activeLanguage: ClickerLanguage = 'en';

export function setClickerLanguage(language: ClickerLanguage) {
  activeLanguage = language;
}

export function clickerText(english: string, vietnamese: string): string {
  return activeLanguage === 'vi' ? vietnamese : english;
}
