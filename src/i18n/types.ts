export type Lang = 'en' | 'ru' | 'ur';

export interface I18nText {
  en: string;
  ru: string;
  ur: string;
}

export interface I18nMasala {
  question: I18nText;
  answer: I18nText;
  reference: string;
  important?: boolean;
}
