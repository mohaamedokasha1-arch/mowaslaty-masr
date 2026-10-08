import TripPlanner from '@/components/TripPlanner';
import PopularRoutes from '@/components/PopularRoutes';
import CityHighlights from '@/components/CityHighlights';

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>وصّلك بأسهل طريقة في مصر 🚏</h1>
          <p>
            خطط رحلتك بالأتوبيس، الميكروباص، المترو أو القطار — قارن بين الأسرع والأرخص وأقل
            تبديلات، بأسعار ومواعيد محدّثة من المجتمع وفريق التحقق.
          </p>
          <div className="badges">
            <span>🚌 خطوط الأتوبيس والميكروباص</span>
            <span>🚇 مترو الأنفاق</span>
            <span>🚂 القطارات الإقليمية</span>
            <span>🤝 بيانات مجتمعية موثّقة</span>
          </div>
        </div>
      </section>

      <div className="container planner-wrap">
        <TripPlanner />
      </div>

      <section className="section">
        <div className="container">
          <h2>لماذا مواصلاتي مصر؟</h2>
          <p className="section-sub">منصة واحدة تجمع كل ما تحتاجه للتنقل بين المدن وداخلها</p>
          <div className="grid-3">
            <div className="card feature-card">
              <div className="icon">🧭</div>
              <h3>تخطيط رحلات ذكي</h3>
              <p>
                محرك بحث يحسب أفضل مسار بين أي نقطتين: يجمع بين المشي والركوب والتبديل بين
                الخطوط، ويرتّب النتائج حسب أولويتك.
              </p>
            </div>
            <div className="card feature-card">
              <div className="icon">💰</div>
              <h3>أسعار محدّثة</h3>
              <p>
                أجرة كل خط مسجّلة بتاريخ آخر تحديث، وأي تغيير يمر عبر سجل التحديثات ومراجعة
                البلاغات قبل اعتماده.
              </p>
            </div>
            <div className="card feature-card">
              <div className="icon">✅</div>
              <h3>مستوى ثقة لكل خط</h3>
              <p>
                كل خط يحمل درجة موثوقية (موثوق / تم التحقق / بحاجة لمراجعة) لتعرف مدى دقة
                المعلومات قبل التحرك.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <PopularRoutes />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <CityHighlights />
        </div>
      </section>
    </>
  );
}
