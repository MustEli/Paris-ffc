import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import commonEn from './locales/en/common.json';
import loginEn from './locales/en/login.json';
import dashboardEn from './locales/en/dashboard.json';
import taskBoardEn from './locales/en/taskBoard.json';
import receptionsEn from './locales/en/receptions.json';
import receptionReportsEn from './locales/en/receptionReports.json';
import sellerStockEn from './locales/en/sellerStock.json';
import schedulesEn from './locales/en/schedules.json';
import referenceListsEn from './locales/en/referenceLists.json';
import chartsEn from './locales/en/charts.json';
import issueReportsEn from './locales/en/issueReports.json';

import commonFr from './locales/fr/common.json';
import loginFr from './locales/fr/login.json';
import dashboardFr from './locales/fr/dashboard.json';
import taskBoardFr from './locales/fr/taskBoard.json';
import receptionsFr from './locales/fr/receptions.json';
import receptionReportsFr from './locales/fr/receptionReports.json';
import sellerStockFr from './locales/fr/sellerStock.json';
import schedulesFr from './locales/fr/schedules.json';
import referenceListsFr from './locales/fr/referenceLists.json';
import chartsFr from './locales/fr/charts.json';
import issueReportsFr from './locales/fr/issueReports.json';

export const LANGUAGE_STORAGE_KEY = 'warehouse-hq-language';

const storedLanguage = (() => {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return value === 'fr' ? 'fr' : 'en';
  } catch {
    return 'en';
  }
})();

void i18next.use(initReactI18next).init({
  lng: storedLanguage,
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [
    'common',
    'login',
    'dashboard',
    'taskBoard',
    'receptions',
    'receptionReports',
    'sellerStock',
    'schedules',
    'referenceLists',
    'charts',
    'issueReports',
  ],
  resources: {
    en: {
      common: commonEn,
      login: loginEn,
      dashboard: dashboardEn,
      taskBoard: taskBoardEn,
      receptions: receptionsEn,
      receptionReports: receptionReportsEn,
      sellerStock: sellerStockEn,
      schedules: schedulesEn,
      referenceLists: referenceListsEn,
      charts: chartsEn,
      issueReports: issueReportsEn,
    },
    fr: {
      common: commonFr,
      login: loginFr,
      dashboard: dashboardFr,
      taskBoard: taskBoardFr,
      receptions: receptionsFr,
      receptionReports: receptionReportsFr,
      sellerStock: sellerStockFr,
      schedules: schedulesFr,
      referenceLists: referenceListsFr,
      charts: chartsFr,
      issueReports: issueReportsFr,
    },
  },
  interpolation: { escapeValue: false },
});

export function setLanguage(language: 'en' | 'fr') {
  void i18next.changeLanguage(language);
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Private-browsing / blocked storage — language still changes for this session.
  }
}

export default i18next;
