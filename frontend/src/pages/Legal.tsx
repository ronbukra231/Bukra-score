import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useLanguage } from '../i18n/index'
import LanguageToggle from '../components/LanguageToggle'

// ── Section component ─────────────────────────────────────────────────────────
function Section({ title, children, dir }: { title: string; children: React.ReactNode; dir?: 'ltr' | 'rtl' }) {
  return (
    <section className="space-y-3" dir={dir}>
      {/* unicodeBidi isolate: first strong char (letter) anchors direction, keeps "1." on correct side */}
      <h2
        className="text-white font-bold text-lg border-b border-gray-800 pb-2"
        style={{ unicodeBidi: 'isolate' }}
      >
        {title}
      </h2>
      <div className="space-y-3 text-gray-400 text-sm leading-7">{children}</div>
    </section>
  )
}

// ── Hebrew content ─────────────────────────────────────────────────────────────
function HebrewContent() {
  return (
    <div className="space-y-10" dir="rtl">

      <Section title="1. מידע פיננסי בלבד — לא ייעוץ השקעות">
        <p>
          בוקרה קפיטל הוא כלי מחקר פיננסי חינוכי. כל המידע, הציונים, הניתוחים והסיכומים המוצגים בפלטפורמה זו
          מיועדים למטרות מידע כלליות בלבד.
        </p>
        <p>
          <strong className="text-gray-200">אין לראות בתוכן הפלטפורמה ייעוץ השקעות, המלצת קנייה, המלצת מכירה,
          ייעוץ פיננסי, ייעוץ משפטי, או תחליף לכל שירות ייעוץ מקצועי אחר.</strong>
        </p>
        <p>
          לפני כל החלטת השקעה, מומלץ להתייעץ עם יועץ השקעות מורשה המורשה על-ידי הרשות לניירות ערך בישראל (ר.נ.ע)
          או גוף פיקוח מוסמך אחר במדינתך.
        </p>
      </Section>

      <Section title="2. דיוק הנתונים">
        <p>
          הנתונים הפיננסיים המוצגים בבוקרה קפיטל מגיעים ממקורות חיצוניים ועשויים להיות:
        </p>
        <ul className="list-disc list-inside space-y-1 mr-2">
          <li>מושהים (לא בזמן אמת)</li>
          <li>חלקיים או חסרים עבור חברות מסוימות</li>
          <li>שגויים בשל שגיאות במקור הנתונים</li>
          <li>שונים מהדוחות הרשמיים של החברה</li>
        </ul>
        <p>
          בוקרה קפיטל אינה מתחייבת לדיוק, שלמות, עדכניות, או אמינות המידע. השימוש בנתונים הוא על אחריות המשתמש בלבד.
        </p>
      </Section>

      <Section title="3. ציון בוקרה וביצועי עבר">
        <p>
          ציון בוקרה הוא מדד כמותי המבוסס על ניתוח נתונים פיננסיים היסטוריים. הציון אינו תחזית לביצועי המניה
          בעתיד ואינו ערובה לתשואה חיובית.
        </p>
        <p>
          ביצועי עבר של ציונים גבוהים אינם מבטיחים תוצאות דומות בעתיד. שוק ההון כרוך בסיכון, וערך ההשקעות
          עלול לעלות או לרדת.
        </p>
      </Section>

      <Section title="4. סיכומי AI">
        <p>
          חלק מהתוכן בפלטפורמה נוצר בסיוע בינה מלאכותית (AI). התוכן המיוצר על-ידי AI:
        </p>
        <ul className="list-disc list-inside space-y-1 mr-2">
          <li>מבוסס על נתונים מחושבים בלבד ואינו המלצת השקעה</li>
          <li>עשוי להכיל אי-דיוקים או טעויות</li>
          <li>אינו מהווה חוות דעת של אנליסט מורשה</li>
          <li>לא עבר ביקורת של גורם פיקוחי</li>
        </ul>
        <p>
          כל תוכן המסומן כ"ניתוח AI" הוא תוצר אוטומטי ואין להסתמך עליו כמקור בלעדי לקבלת החלטות.
        </p>
      </Section>

      <Section title="5. פרטיות ואבטחת מידע">
        <p>
          בוקרה קפיטל <strong className="text-gray-200">אינה אוספת מידע אישי מזהה</strong> מהמשתמשים. הפלטפורמה
          אינה מחייבת הרשמה, כניסה, או מסירת פרטים אישיים כלשהם.
        </p>
        <p>
          <strong className="text-gray-200">עוגיות ו-localStorage:</strong> הפלטפורמה שומרת העדפות שפה ותוצאות
          חיפוש אחרונות ב-localStorage של הדפדפן שלך בלבד. נתונים אלה אינם מועברים לשרתינו ואינם משותפים עם
          צד שלישי.
        </p>
        <p>
          <strong className="text-gray-200">יומני שרת:</strong> כתובות IP עשויות להופיע ביומני גישה סטנדרטיים
          של שרת האחסון. מידע זה אינו נמכר, אינו משותף, ונמחק באופן אוטומטי בהתאם למדיניות ספק האחסון.
        </p>
        <p>
          <strong className="text-gray-200">ניתוח ומעקב:</strong> הפלטפורמה אינה משתמשת ב-Google Analytics,
          Mixpanel, או כלי מעקב אחרים.
        </p>
      </Section>

      <Section title="6. שירותי צד שלישי">
        <p>
          הפלטפורמה עושה שימוש בשירותים חיצוניים לצורך אספקת נתונים פיננסיים ויכולות AI. שירותים אלה
          כפופים לתנאי השימוש שלהם בנפרד. בוקרה קפיטל אינה אחראית לדיוק, זמינות, או שינויים בנתונים
          המגיעים ממקורות חיצוניים.
        </p>
      </Section>

      <Section title="7. הגבלת אחריות">
        <p>
          הפלטפורמה מסופקת "כפי שהיא" (AS IS) ללא כל אחריות מפורשת או משתמעת. בוקרה קפיטל, מנהליה,
          עובדיה, ומפתחיה לא יהיו אחראים לכל נזק ישיר, עקיף, מיוחד, או תוצאתי הנובע משימוש בפלטפורמה
          או מהסתמכות על המידע המוצג בה.
        </p>
      </Section>

      <Section title="8. שינויים בתנאים">
        <p>
          בוקרה קפיטל שומרת לעצמה את הזכות לעדכן תנאים אלה בכל עת. המשך השימוש בפלטפורמה לאחר פרסום
          שינויים מהווה הסכמה לתנאים המעודכנים.
        </p>
      </Section>

      <Section title="יצירת קשר">
        <p>
          לשאלות, הערות, או בקשות הקשורות לפרטיות ותנאי השימוש, ניתן לפנות אלינו בדוא"ל:
        </p>
        <p>
          <a
            href="mailto:info@bukracapital.com"
            className="text-brand-400 hover:text-brand-300 transition"
          >
            info@bukracapital.com
          </a>
        </p>
      </Section>

    </div>
  )
}

// ── English content ────────────────────────────────────────────────────────────
function EnglishContent() {
  return (
    <div className="space-y-10" dir="ltr">

      <Section title="1. Financial Information Only — Not Investment Advice">
        <p>
          Bukra Capital is an educational financial research tool. All information, scores, analyses, and
          summaries displayed on this platform are intended for general informational purposes only.
        </p>
        <p>
          <strong className="text-gray-200">Nothing on this platform constitutes investment advice,
          a recommendation to buy or sell securities, financial advice, legal advice, or a substitute
          for any professional advisory service.</strong>
        </p>
        <p>
          Before making any investment decision, consult a licensed investment advisor regulated by the
          Israel Securities Authority (ISA), the SEC, or the relevant authority in your jurisdiction.
        </p>
      </Section>

      <Section title="2. Data Accuracy">
        <p>
          Financial data on Bukra Capital is sourced from third-party providers and may be:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Delayed (not real-time)</li>
          <li>Incomplete or missing for certain companies</li>
          <li>Inaccurate due to source data errors</li>
          <li>Different from a company's official filings</li>
        </ul>
        <p>
          Bukra Capital makes no warranty regarding the accuracy, completeness, timeliness, or reliability
          of any information. Use of this data is at your own risk.
        </p>
      </Section>

      <Section title="3. Bukra Score and Past Performance">
        <p>
          Bukra Score is a quantitative metric based on historical financial data analysis. It is not a
          forecast of future stock performance and does not guarantee positive returns.
        </p>
        <p>
          Past performance of high-scoring companies does not guarantee similar results in the future.
          Investing involves risk; the value of investments may go up or down.
        </p>
      </Section>

      <Section title="4. AI-Generated Content">
        <p>
          Some content on this platform is generated with the assistance of artificial intelligence (AI).
          AI-generated content:
        </p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Is based solely on calculated data and is not an investment recommendation</li>
          <li>May contain inaccuracies or errors</li>
          <li>Does not represent the opinion of a licensed analyst</li>
          <li>Has not been reviewed by any regulatory authority</li>
        </ul>
        <p>
          Any content labeled as "AI analysis" is automated output and should not be relied upon as a
          sole basis for decision-making.
        </p>
      </Section>

      <Section title="5. Privacy and Data Security">
        <p>
          Bukra Capital <strong className="text-gray-200">does not collect personally identifiable
          information</strong> from users. The platform requires no registration, login, or submission
          of personal details.
        </p>
        <p>
          <strong className="text-gray-200">Cookies and localStorage:</strong> The platform stores
          language preferences and recent search results in your browser's localStorage only. This data
          is not transmitted to our servers and is not shared with any third party.
        </p>
        <p>
          <strong className="text-gray-200">Server logs:</strong> IP addresses may appear in standard
          server access logs. This information is not sold or shared, and is automatically deleted
          according to our hosting provider's policy.
        </p>
        <p>
          <strong className="text-gray-200">Analytics and tracking:</strong> The platform does not use
          Google Analytics, Mixpanel, or any other tracking tools.
        </p>
      </Section>

      <Section title="6. Third-Party Services">
        <p>
          The platform uses external services for financial data and AI capabilities. These services are
          subject to their own terms of use. Bukra Capital is not responsible for the accuracy,
          availability, or changes in data sourced from external providers.
        </p>
      </Section>

      <Section title="7. Limitation of Liability">
        <p>
          The platform is provided "AS IS" without any express or implied warranty. Bukra Capital,
          its officers, employees, and developers shall not be liable for any direct, indirect, special,
          or consequential damages arising from use of the platform or reliance on information displayed herein.
        </p>
      </Section>

      <Section title="8. Changes to These Terms">
        <p>
          Bukra Capital reserves the right to update these terms at any time. Continued use of the
          platform after changes are posted constitutes acceptance of the updated terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For questions, comments, or privacy-related requests, contact us at:
        </p>
        <p>
          <a
            href="mailto:info@bukracapital.com"
            className="text-brand-400 hover:text-brand-300 transition"
          >
            info@bukracapital.com
          </a>
        </p>
      </Section>

    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Legal() {
  const { t, isHe } = useLanguage()

  return (
    <div className="min-h-screen bg-gray-950" dir={isHe ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-900">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white transition flex-shrink-0">
            <ArrowRight className="w-5 h-5" />
          </Link>
          <span className="text-gray-400 text-sm font-medium flex-1">
            {isHe ? 'בוקרה קפיטל' : 'Bukra Capital'}
          </span>
          <LanguageToggle />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10" dir={isHe ? 'rtl' : 'ltr'}>
          <h1 className="text-2xl font-black text-white mb-2">{t.legal_title}</h1>
          <p className="text-gray-500 text-sm">{t.legal_lastUpdated}</p>
        </div>

        {/* Content — switches by language */}
        {isHe ? <HebrewContent /> : <EnglishContent />}

        {/* Footer nav */}
        <div className="mt-16 pt-8 border-t border-gray-800 text-center">
          <Link to="/" className="text-brand-400 hover:text-brand-300 text-sm transition">
            {isHe ? '← חזרה לדף הבית' : '← Back to Home'}
          </Link>
        </div>
      </div>
    </div>
  )
}
