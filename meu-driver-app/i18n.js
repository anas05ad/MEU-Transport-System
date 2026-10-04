import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

const resources = {
  en: {
    translation: {
      "settings": "Settings",
      "tracking": "Tracking",
      "language": "Language",
      "call_admin": "Call Admin",
      "logout": "Logout",
      "report_error": "Report Error",
      "cancel": "Cancel",
      "submit": "Submit",
      "issue_placeholder": "Describe the issue...",
      "sent": "Sent!",
      "error": "Error",
      "assignment": "ASSIGNMENT",
      "no_active_route": "No Active Route",
      "stop_trip": "STOP TRIP",
      "start_trip": "START TRIP",
      "broadcasting_live": "Broadcasting Live",
      "finding_gps": "Finding GPS...",
      "ready": "Ready",
      "initializing": "Initializing...",
      "report_title": "Report an Issue"
    }
  },
  ar: {
    translation: {
      "settings": "الإعدادات",
      "tracking": "تتبع الحافلة",
      "language": "اللغة",
      "call_admin": "اتصل بالإدارة",
      "logout": "تسجيل خروج",
      "report_error": "إبلاغ عن مشكلة",
      "cancel": "إلغاء",
      "submit": "إرسال",
      "issue_placeholder": "وصف المشكلة...",
      "sent": "تم الإرسال!",
      "error": "خطأ",
      "assignment": "المهمة الحالية",
      "no_active_route": "لا يوجد مسار نشط",
      "stop_trip": "إنهاء الرحلة",
      "start_trip": "بدء الرحلة",
      "broadcasting_live": "بث مباشر",
      "finding_gps": "جاري البحث عن الموقع...",
      "ready": "جاهز",
      "initializing": "جاري التحميل...",
      "report_title": "إبلاغ عن مشكلة"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: I18nManager.isRTL ? 'ar' : 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false }
  });

export default i18n;