import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

const resources = {
  en: {
    translation: {
      "welcome": "Welcome",
      "to_campus": "To MEU Campus",
      "from_campus": "From MEU Campus",
      "sign_out": "Sign Out",
      "settings": "Settings",
      "language": "Language",
      "theme": "Theme",
      "dark_mode": "Dark Mode",
      "light_mode": "Light Mode",
      "change_name": "Change Name",
      "update": "Update",
      "rate_us": "Rate Us",
      "version": "Version 1.0.0",
      "developer": "Dev by Eng. Anas Hassan",
      "search_placeholder": "Search Route (e.g. Route 1)...",
      "upcoming_stops": "UPCOMING STOPS",
      "bus": "Bus",
      "seats": "Seats",
      "full": "FULL",
      "open": "OPEN",
      "close": "Close",
      "calculating": "Calculating times...",
      "no_data": "No stops data",
      "name_updated": "Name Updated Successfully!",
      "rate_msg": "Thank you for using MEU Bus! ⭐⭐⭐⭐⭐",
      "error": "Error",
      "success": "Success",
      "cancel": "Cancel",
      "save": "Save",
      "report_error": "Report Error",
      "issue_placeholder": "Describe the issue...",
      "sent": "Sent!",
      "submit": "Submit",
      "report_title": "Report an Issue"
    }
  },
  ar: {
    translation: {
      "welcome": "مرحباً",
      "to_campus": "إلى جامعة الشرق الأوسط",
      "from_campus": "من جامعة الشرق الأوسط",
      "sign_out": "تسجيل خروج",
      "settings": "الإعدادات",
      "language": "اللغة",
      "theme": "المظهر",
      "dark_mode": "الوضع الداكن",
      "light_mode": "الوضع الفاتح",
      "change_name": "تغيير الاسم",
      "update": "تحديث",
      "rate_us": "قيّمنا",
      "version": "الإصدار 1.0.0",
      "developer": "تطوير م. أنس حسن",
      "search_placeholder": "ابحث عن خط (مثال: خط 1)...",
      "upcoming_stops": "المحطات القادمة",
      "bus": "حافلة",
      "seats": "مقاعد",
      "full": "ممتلئ",
      "open": "متاح",
      "close": "إغلاق",
      "calculating": "جاري حساب الوقت...",
      "no_data": "لا توجد بيانات",
      "name_updated": "تم تحديث الاسم بنجاح!",
      "rate_msg": "شكراً لاستخدامك حافلات الشرق الأوسط! ⭐⭐⭐⭐⭐",
      "error": "خطأ",
      "success": "نجاح",
      "cancel": "إلغاء",
      "save": "حفظ",
      "report_error": "إبلاغ عن مشكلة",
      "issue_placeholder": "وصف المشكلة...",
      "sent": "تم الإرسال!",
      "submit": "إرسال",
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