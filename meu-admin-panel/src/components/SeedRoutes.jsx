import React, { useState } from "react";
import { db } from "../firebase"; 
import { collection, getDocs, deleteDoc, doc, addDoc } from "firebase/firestore";

const SeedRoutes = () => {
  const [status, setStatus] = useState("");

  // 1. Fixed Destination: Middle East University (MEU)
  const MEU_COORDS = { latitude: 31.805630, longitude: 35.920587 };

  // 2. Comprehensive MEU Real Routes extracted from Official Schedule (2025/2026)
  const meuRealRoutes = [
    { 
      name: "مستشفى الأردن (Jordan Hospital)", 
      startLocation: { latitude: 31.9567, longitude: 35.9090 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "مقابل مستشفى الأردن", latitude: 31.9567, longitude: 35.9090 },
        { name: "دوار عبدون", latitude: 31.9420, longitude: 35.8910 },
        { name: "دوار تاج مول", latitude: 31.9380, longitude: 35.8990 }
      ]
    },
    { 
      name: "مختار مول (Mukhtar Mall)", 
      startLocation: { latitude: 31.9860, longitude: 35.9040 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "07:50", "10:00", "12:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "دوار الداخلية كازية جوبترول", latitude: 31.9670, longitude: 35.9120 },
        { name: "المختار مول", latitude: 31.9860, longitude: 35.9040 },
        { name: "بعد جسر الصحافة", latitude: 31.9920, longitude: 35.8980 },
        { name: "شارع المدينة مقابل كارفور", latitude: 31.9820, longitude: 35.8750 }
      ]
    },
    { 
      name: "ضاحية الرشيد (Dahiet Al-Rasheed)", 
      startLocation: { latitude: 32.0110, longitude: 35.8820 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "بعد دوار اقرأ", latitude: 32.0110, longitude: 35.8820 },
        { name: "المركز الصحي", latitude: 32.0080, longitude: 35.8850 },
        { name: "مدرسة المنهل", latitude: 32.0050, longitude: 35.8880 },
        { name: "سكن أميمة", latitude: 32.0010, longitude: 35.8900 }
      ]
    },
    { 
      name: "ش المدينة المنورة / ش عبدالله غوشة (Madinah / Ghosheh St)", 
      startLocation: { latitude: 31.9680, longitude: 35.8600 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:50", "08:15", "10:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "حلويات حبيبة بعد دوار الواحة", latitude: 31.9900, longitude: 35.8620 },
        { name: "بعد دوار الكيلو", latitude: 31.9650, longitude: 35.8550 },
        { name: "مجمع جبر", latitude: 31.9580, longitude: 35.8520 },
        { name: "بعد الدوار السابع دخلة الملكية", latitude: 31.9540, longitude: 35.8500 }
      ]
    },
    { 
      name: "الجاردنز (Gardens)", 
      startLocation: { latitude: 31.9800, longitude: 35.8800 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00"],
      returnTimes: ["14:15", "16:15", "17:00"],
      stops: [
        { name: "بن العميد الجاردنز", latitude: 31.9800, longitude: 35.8800 },
        { name: "إشارة السيرك", latitude: 31.9780, longitude: 35.8720 },
        { name: "إشارة جبري", latitude: 31.9750, longitude: 35.8680 },
        { name: "مقابل السروات", latitude: 31.9720, longitude: 35.8620 }
      ]
    },
    { 
      name: "الجامعة الأردنية (University of Jordan)", 
      startLocation: { latitude: 32.0160, longitude: 35.8690 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "07:50", "10:00", "12:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "سامح مول صويلح", latitude: 32.0250, longitude: 35.8450 },
        { name: "إشارة الدوريات", latitude: 32.0200, longitude: 35.8550 },
        { name: "KFC شارع الجامعة", latitude: 32.0150, longitude: 35.8700 },
        { name: "كازية توتال مقابل مستشفى الجامعة", latitude: 32.0080, longitude: 35.8750 }
      ]
    },
    { 
      name: "خلدا (Khalda)", 
      startLocation: { latitude: 31.9900, longitude: 35.8320 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00"],
      returnTimes: ["14:15", "16:15", "17:00"],
      stops: [
        { name: "إشارة البشيتي", latitude: 31.9920, longitude: 35.8350 },
        { name: "إشارة البنك العربي", latitude: 31.9880, longitude: 35.8380 },
        { name: "بعد دوار السكر", latitude: 31.9840, longitude: 35.8420 },
        { name: "بعد دوار النعيمات", latitude: 31.9800, longitude: 35.8480 }
      ]
    },
    { 
      name: "سحاب (Sahab)", 
      startLocation: { latitude: 31.8700, longitude: 36.0050 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "09:50"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "صيدلية الأردن باتجاه النهر الخالد", latitude: 31.8700, longitude: 36.0050 },
        { name: "بعد دوار العبدلية", latitude: 31.8650, longitude: 35.9980 },
        { name: "بعد دوار المستندة", latitude: 31.8600, longitude: 35.9850 },
        { name: "بعد دوار المنقل", latitude: 31.8500, longitude: 35.9700 },
        { name: "جبل الحديد", latitude: 31.8400, longitude: 35.9550 }
      ]
    },
    { 
      name: "إشارة الجويدة (Al-Jwaydehh Traffic Light)", 
      startLocation: { latitude: 31.9000, longitude: 35.9400 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["07:10", "08:25", "10:25"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00"],
      stops: [
        { name: "إشارة الجويدة", latitude: 31.9000, longitude: 35.9400 },
        { name: "مطعم أبو زغلة", latitude: 31.8960, longitude: 35.9420 },
        { name: "إشارة خريبة السوق", latitude: 31.8900, longitude: 35.9380 },
        { name: "إشارات جاوا", latitude: 31.8750, longitude: 35.9300 },
        { name: "الأحوال المدنية اليادودة", latitude: 31.8600, longitude: 35.9250 },
        { name: "بعد إشارة كان زمان", latitude: 31.8450, longitude: 35.9220 }
      ]
    },
    { 
      name: "الوحدات (Al-Wehdat)", 
      startLocation: { latitude: 31.9250, longitude: 35.9350 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "إشارة البادية", latitude: 31.9250, longitude: 35.9350 },
        { name: "إشارة دخلة رشاد", latitude: 31.9200, longitude: 35.9300 },
        { name: "فندق الخليج", latitude: 31.9150, longitude: 35.9250 },
        { name: "مثلث الإذاعة", latitude: 31.9080, longitude: 35.9200 }
      ]
    },
    { 
      name: "المقابلين (Al-Muqabalain)", 
      startLocation: { latitude: 31.9100, longitude: 35.9050 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "مدخل البنيات طريق المطار", latitude: 31.9100, longitude: 35.9050 },
        { name: "بعد دوار مرعي", latitude: 31.9050, longitude: 35.9100 },
        { name: "بعد مدارس المحور", latitude: 31.9020, longitude: 35.9150 },
        { name: "صيدلية الرنتيسي", latitude: 31.8980, longitude: 35.9200 },
        { name: "مسجد الصفا والمروى", latitude: 31.8920, longitude: 35.9230 },
        { name: "بعد إشارة أبو زغلة", latitude: 31.8880, longitude: 35.9250 }
      ]
    },
    { 
      name: "البيادر (Bayader Al-Zahra)", 
      startLocation: { latitude: 31.9500, longitude: 35.8300 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "صيدلية سعد", latitude: 31.9500, longitude: 35.8300 },
        { name: "البنك التجاري", latitude: 31.9450, longitude: 35.8350 },
        { name: "بعد دوار النهضة", latitude: 31.9380, longitude: 35.8450 }
      ]
    },
    { 
      name: "السلط (As-Salt)", 
      startLocation: { latitude: 32.0390, longitude: 35.7270 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30"],
      returnTimes: ["16:15", "17:00", "18:00"],
      stops: [
        { name: "موقف الجامعة الهاشمية", latitude: 32.0390, longitude: 35.7270 },
        { name: "الدبابنة", latitude: 32.0300, longitude: 35.7400 },
        { name: "بعد دوار الكمالية", latitude: 32.0200, longitude: 35.7700 },
        { name: "الارسال", latitude: 32.0100, longitude: 35.7900 },
        { name: "بعد دوار خلدا", latitude: 31.9900, longitude: 35.8320 }
      ]
    },
    { 
      name: "أبو نصير (Abu Nseir)", 
      startLocation: { latitude: 32.0600, longitude: 35.8800 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "09:30"],
      returnTimes: ["14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "إشارة التطبيقية", latitude: 32.0600, longitude: 35.8800 },
        { name: "السوق التجاري", latitude: 32.0550, longitude: 35.8750 },
        { name: "بعد دوار الأميرة بسمة", latitude: 32.0480, longitude: 35.8700 },
        { name: "بعد دوار المنهل", latitude: 32.0350, longitude: 35.8650 },
        { name: "إشارة الدوريات", latitude: 32.0200, longitude: 35.8550 },
        { name: "دفاع مدني صويلح", latitude: 32.0300, longitude: 35.8400 },
        { name: "بعد دوار خلدا", latitude: 31.9900, longitude: 35.8320 }
      ]
    },
    { 
      name: "الحزام / ام نوارة (Al-Hizam / Um Nuwarah)", 
      startLocation: { latitude: 31.9500, longitude: 36.0100 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "كلية البوليتكنك", latitude: 31.9500, longitude: 36.0100 },
        { name: "إشارة نادي السباق", latitude: 31.9450, longitude: 36.0000 },
        { name: "إشارة الغاز", latitude: 31.9380, longitude: 35.9850 },
        { name: "مقابل مطعم المراسل", latitude: 31.9300, longitude: 35.9750 }
      ]
    },
    { 
      name: "أم نوارة (Um Nuwarah)", 
      startLocation: { latitude: 31.9400, longitude: 35.9800 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["08:00"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "مقابل مطعم المراسل", latitude: 31.9300, longitude: 35.9750 },
        { name: "إشارات الجسور العشرة", latitude: 31.9250, longitude: 35.9600 },
        { name: "إشارة بيتنا", latitude: 31.9200, longitude: 35.9450 },
        { name: "دوار الشرق الأوسط فندق الخليج", latitude: 31.9150, longitude: 35.9250 }
      ]
    },
    { 
      name: "البقعة (Al-Baq'a)", 
      startLocation: { latitude: 32.0750, longitude: 35.8500 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30"],
      returnTimes: ["16:15", "17:00", "18:00"],
      stops: [
        { name: "بعد دوار الشؤون", latitude: 32.0750, longitude: 35.8500 },
        { name: "بعد دوار عين الباشا", latitude: 32.0650, longitude: 35.8350 },
        { name: "طلوع صافوط", latitude: 32.0500, longitude: 35.8300 },
        { name: "بعد دوار خلدا", latitude: 31.9900, longitude: 35.8320 },
        { name: "مقابل شركة زين", latitude: 31.9550, longitude: 35.8500 }
      ]
    },
    { 
      name: "الجيزة (Al-Jizah)", 
      startLocation: { latitude: 31.6980, longitude: 35.9560 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "مجمع مادبا", latitude: 31.6980, longitude: 35.9560 },
        { name: "محكمة صلح الجيزة", latitude: 31.7020, longitude: 35.9540 },
        { name: "مركز دفاع مدني الجيزة", latitude: 31.7100, longitude: 35.9500 },
        { name: "مسجد مدخل القسطل", latitude: 31.7450, longitude: 35.9400 },
        { name: "مسجد زيد بن حارثة", latitude: 31.7700, longitude: 35.9320 }
      ]
    },
    { 
      name: "الموقر الذهبية الغربي اللبن (Al-Muwaqqar / Al-Laban)", 
      startLocation: { latitude: 31.8150, longitude: 36.1600 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:25"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "بعد دوار الصقر", latitude: 31.8150, longitude: 36.1600 },
        { name: "مقابل مدرسة الموقر للبنين", latitude: 31.8120, longitude: 36.1500 },
        { name: "مثلث النقيرة", latitude: 31.8100, longitude: 36.1350 },
        { name: "إشارة الفيصلية", latitude: 31.8080, longitude: 36.1150 },
        { name: "جسر الذهبية الغربي", latitude: 31.8060, longitude: 36.0900 },
        { name: "مقابل أسواق أبو عارِف", latitude: 31.8040, longitude: 36.0700 },
        { name: "مقابل المسجد الكبير", latitude: 31.8030, longitude: 36.0500 },
        { name: "بعد جسر اللبن", latitude: 31.8020, longitude: 36.0200 },
        { name: "مقابل مسجد تبارك", latitude: 31.8010, longitude: 35.9900 },
        { name: "جمعية عمل يد الخير", latitude: 31.8005, longitude: 35.9600 }
      ]
    },
    { 
      name: "القويسمة والزهور (Qwaysemh & Al-Zohour)", 
      startLocation: { latitude: 31.9200, longitude: 35.9550 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "بعد دوار بنك الإسكان القويسمة", latitude: 31.9200, longitude: 35.9550 },
        { name: "إشارة كارفور", latitude: 31.9150, longitude: 35.9480 },
        { name: "بعد دوار الزهور", latitude: 31.9100, longitude: 35.9350 },
        { name: "جمعية السماعنة", latitude: 31.9050, longitude: 35.9300 },
        { name: "مطعم أبو زغلة خريبة السوق", latitude: 31.8960, longitude: 35.9420 }
      ]
    },
    { 
      name: "مادبا (Madaba)", 
      startLocation: { latitude: 31.7160, longitude: 35.7940 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "مجمع مادبا", latitude: 31.7160, longitude: 35.7940 },
        { name: "موقف الجامعة الأردنية", latitude: 31.7220, longitude: 35.7980 },
        { name: "العلميناوي", latitude: 31.7300, longitude: 35.8050 },
        { name: "بعد دوار المحبة", latitude: 31.7400, longitude: 35.8150 }
      ]
    },
    { 
      name: "صويلح (Sweileh)", 
      startLocation: { latitude: 32.0300, longitude: 35.8300 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["08:00", "10:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "الدفاع المدني", latitude: 32.0300, longitude: 35.8300 },
        { name: "بعد دوار خلدا", latitude: 31.9900, longitude: 35.8320 },
        { name: "مقابل زين", latitude: 31.9550, longitude: 35.8500 },
        { name: "البنك التجاري", latitude: 31.9450, longitude: 35.8350 }
      ]
    },
    { 
      name: "مرج الحمام (Marj Al-Hamam)", 
      startLocation: { latitude: 31.8950, longitude: 35.8580 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "مقابل كلية القدس", latitude: 31.8950, longitude: 35.8580 },
        { name: "إسكان الضباط", latitude: 31.8900, longitude: 35.8520 },
        { name: "بعد دوار الشوابكة", latitude: 31.8850, longitude: 35.8480 },
        { name: "بعد دوار البرديني", latitude: 31.8800, longitude: 35.8450 },
        { name: "بعد دوار الدلة", latitude: 31.8750, longitude: 35.8400 },
        { name: "بعد دوار الجندي", latitude: 31.8700, longitude: 35.8350 },
        { name: "إسكان السلطة", latitude: 31.8650, longitude: 35.8300 },
        { name: "نفق الخربة شارع الخدمات", latitude: 31.8600, longitude: 35.8500 }
      ]
    },
    { 
      name: "ناعور (Na'our)", 
      startLocation: { latitude: 31.8680, longitude: 35.8250 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00"],
      returnTimes: ["14:15", "16:15", "17:00"],
      stops: [
        { name: "مثلث ناعور بنك الإسكان", latitude: 31.8680, longitude: 35.8250 },
        { name: "بعد دوار الشهيد صهيب", latitude: 31.8620, longitude: 35.8200 },
        { name: "نفق السلام", latitude: 31.8550, longitude: 35.8300 },
        { name: "إسكان الرضوان", latitude: 31.8480, longitude: 35.8400 },
        { name: "إشارات أم البساتين", latitude: 31.8350, longitude: 35.8550 }
      ]
    },
    { 
      name: "مادبا الغربي (Madaba Al-Gharbi)", 
      startLocation: { latitude: 31.7200, longitude: 35.7800 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00"],
      returnTimes: ["14:15", "16:15", "17:00"],
      stops: [
        { name: "إشارات الدفاع المدني", latitude: 31.7200, longitude: 35.7800 },
        { name: "إشارات جريتة", latitude: 31.7250, longitude: 35.7850 },
        { name: "إشارات الجامعة الألمانية", latitude: 31.7350, longitude: 35.7950 },
        { name: "إشارات حسبان", latitude: 31.7450, longitude: 35.8050 },
        { name: "إشارات المنصورة", latitude: 31.7550, longitude: 35.8150 },
        { name: "جسر شركة الدخان", latitude: 31.7650, longitude: 35.8250 }
      ]
    },
    { 
      name: "نزال (Nazzal)", 
      startLocation: { latitude: 31.9350, longitude: 35.9100 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "07:50", "10:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "بعد دوار اللوزي", latitude: 31.9350, longitude: 35.9100 },
        { name: "مسجد نزال الكبير", latitude: 31.9300, longitude: 35.9080 },
        { name: "بعد دوار علي صقر", latitude: 31.9250, longitude: 35.9050 },
        { name: "حديقة الشباب", latitude: 31.9200, longitude: 35.9020 },
        { name: "بعد دوار الخريطة", latitude: 31.9150, longitude: 35.9000 },
        { name: "بعد دوار مدارس المهارات حي الصحابة", latitude: 31.9080, longitude: 35.8950 }
      ]
    },
    { 
      name: "الزرقاء الجديدة (Zarqaa New)", 
      startLocation: { latitude: 32.0650, longitude: 36.0950 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "إشارات البنك العربي الزرقاء", latitude: 32.0650, longitude: 36.0950 },
        { name: "بعد دوار فزاع", latitude: 32.0600, longitude: 36.0850 },
        { name: "محكمة الزرقاء", latitude: 32.0500, longitude: 36.0750 },
        { name: "المجمع الجديد صيدلية بالي", latitude: 32.0450, longitude: 36.0650 },
        { name: "جسر مشاة ضريبة الدخل", latitude: 32.0300, longitude: 36.0400 },
        { name: "قبل جسر طريق 100", latitude: 31.9800, longitude: 36.0100 }
      ]
    },
    { 
      name: "الزرقاء (Zarqa Main)", 
      startLocation: { latitude: 32.0600, longitude: 36.0900 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["08:05", "10:00"],
      returnTimes: ["14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "المجمع الجديد", latitude: 32.0600, longitude: 36.0900 },
        { name: "مقابل مرايا", latitude: 32.0500, longitude: 36.0800 },
        { name: "جسر مشاة ضريبة الدخل", latitude: 32.0300, longitude: 36.0400 },
        { name: "بعد جسر طريق 100", latitude: 31.9800, longitude: 36.0100 }
      ]
    },
    { 
      name: "ماركا (Marka)", 
      startLocation: { latitude: 31.9850, longitude: 35.9800 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "بعد دوار الطيارة", latitude: 31.9850, longitude: 35.9800 },
        { name: "إشارة مرسيدس", latitude: 31.9750, longitude: 35.9700 },
        { name: "باب الحديد", latitude: 31.9650, longitude: 35.9600 },
        { name: "مثلث عوجان بنك الإسكان", latitude: 31.9550, longitude: 35.9500 }
      ]
    },
    { 
      name: "نادي السباق (Race Club)", 
      startLocation: { latitude: 31.9450, longitude: 36.0000 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:25"],
      returnTimes: ["16:15", "17:00"],
      stops: [
        { name: "مقابل مخابز برتقالة", latitude: 31.9450, longitude: 36.0000 },
        { name: "بعد دوار نادي السباق", latitude: 31.9400, longitude: 35.9900 },
        { name: "إشارة نادي السباق", latitude: 31.9350, longitude: 35.9800 },
        { name: "إشارة الغاز", latitude: 31.9300, longitude: 35.9700 }
      ]
    },
    { 
      name: "رغدان (Raghadan)", 
      startLocation: { latitude: 31.9550, longitude: 35.9450 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00", "12:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00", "18:00"],
      stops: [
        { name: "موقف الأمانة", latitude: 31.9550, longitude: 35.9450 },
        { name: "مقابل نفق المنارة", latitude: 31.9480, longitude: 35.9400 },
        { name: "إشارات بيتنا", latitude: 31.9350, longitude: 35.9350 },
        { name: "فندق الخليج", latitude: 31.9200, longitude: 35.9250 },
        { name: "مثلث الإذاعة", latitude: 31.9080, longitude: 35.9200 }
      ]
    },
    { 
      name: "طبربور (Tabarbour)", 
      startLocation: { latitude: 31.9950, longitude: 35.9200 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "07:30", "09:30"],
      returnTimes: ["12:30", "14:00", "16:15", "17:00"],
      stops: [
        { name: "مقابل كارفور دريم هوم", latitude: 31.9950, longitude: 35.9200 },
        { name: "بعد دوار كوخ الشرطة", latitude: 31.9880, longitude: 35.9180 },
        { name: "KFC طبربور", latitude: 31.9820, longitude: 35.9150 },
        { name: "عريفة مول", latitude: 31.9750, longitude: 35.9120 }
      ]
    },
    { 
      name: "الهاشمي الشمالي (Al-Hashmi Al-Shamali)", 
      startLocation: { latitude: 31.9720, longitude: 35.9550 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "07:50", "09:45"],
      returnTimes: ["14:00", "16:15"],
      stops: [
        { name: "إشارة الصحة", latitude: 31.9720, longitude: 35.9550 },
        { name: "إشارة مستشفى حمزة", latitude: 31.9680, longitude: 35.9480 },
        { name: "إشارة حلويات العنبتاوي", latitude: 31.9600, longitude: 35.9400 },
        { name: "جسر مربط", latitude: 31.9520, longitude: 35.9320 }
      ]
    },
    { 
      name: "الاستقلال ضاحية الأقصى (Al-Istiqlal & Dahiet Al-Aqsa)", 
      startLocation: { latitude: 31.9700, longitude: 35.9300 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00"],
      returnTimes: ["12:30", "14:15", "16:15", "17:00"],
      stops: [
        { name: "إشارة الإقليم", latitude: 31.9700, longitude: 35.9300 },
        { name: "كازية الاستقلال", latitude: 31.9680, longitude: 35.9250 },
        { name: "الاستقلال مول", latitude: 31.9650, longitude: 35.9200 },
        { name: "مجمع بنك الإسكان", latitude: 31.9600, longitude: 35.9150 }
      ]
    },
    { 
      name: "جبل عمان عبدون (Jabal Amman / Abdoun)", 
      startLocation: { latitude: 31.9520, longitude: 35.9180 }, 
      endLocation: MEU_COORDS,
      pickupTimes: ["06:30", "08:00", "10:00"],
      returnTimes: ["14:15", "16:15"],
      stops: [
        { name: "بعد الدوار الثاني", latitude: 31.9520, longitude: 35.9180 },
        { name: "بعد الدوار الثالث", latitude: 31.9530, longitude: 35.9100 },
        { name: "بعد الدوار الرابع", latitude: 31.9540, longitude: 35.9000 },
        { name: "بعد الدوار الخامس", latitude: 31.9550, longitude: 35.8850 },
        { name: "بعد الدوار السادس باتجاه إشارات الكنيسة", latitude: 31.9550, longitude: 35.8650 }
      ]
    }
  ];

  const handleResetRoutes = async () => {
    if(!window.confirm("This will DELETE all existing routes and upload all 24 OFFICIAL REAL MEU ROUTES with STOPS & TIMETABLES. Continue?")) return;

    setStatus("Deleting old routes...");
    try {
      const colRef = collection(db, "routes");
      const snapshot = await getDocs(colRef);
      
      // 1. DELETE ALL EXISTING ROUTES
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, "routes", d.id)));
      await Promise.all(deletePromises);

      // 2. UPLOAD NEW OFFICIAL REAL ROUTES WITH STOPS
      setStatus("Uploading fresh official MEU routes...");
      for (const route of meuRealRoutes) {
        await addDoc(colRef, route);
      }

      setStatus("Success! All 24 Real MEU Routes Uploaded.");
      // Optional: Auto-reload to clear state
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      console.error("Error:", error);
      setStatus("Error: " + error.message);
    }
  };

  return (
    <div style={{ background: "#ffeb3b", padding: "10px", textAlign: "center", borderBottom: "2px solid #ddd" }}>
      <strong>⚠️ Database Tool: </strong>
      <button 
        onClick={handleResetRoutes} 
        style={{ marginLeft: "10px", padding: "8px 15px", cursor: "pointer", background: "#d32f2f", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}
      >
        RESET ROUTES (Add Stops + MEU Dest)
      </button>
      <span style={{ marginLeft: "15px", fontWeight: "bold" }}>{status}</span>
    </div>
  );
};

export default SeedRoutes;