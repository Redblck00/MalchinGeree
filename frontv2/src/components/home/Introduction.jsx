"use client";
import { useEffect, useRef } from "react";

function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("opacity-100", "translate-y-0");
          el.classList.remove("opacity-0", "translate-y-8");
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Загвараас гэрээ үүсгэх",
    desc: "Малын худалдаа, бэлчээр ашиглалт, хамтын ажиллагааны гэрээний бэлэн загваруудыг ашиглаарай.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    title: "Цахим гарын үсэг",
    desc: "Газарзүйн байршлаас үл хамааран гэрээнд цахим гарын үсэг зурж баталгаажуулаарай.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "Гэрээний түүх",
    desc: "Бүх байгуулсан гэрээгээ нэг дор хадгалж, хугацаа болон статусаар шүүн харах боломжтой.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    title: "Мэдэгдэл илгээх",
    desc: "Гэрээний хугацаа дуусахад автоматаар сануулах, нөгөө талдаа мэдэгдэл илгээх.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: "Аюулгүй хадгалалт",
    desc: "Таны гэрээний мэдээлэл шифрлэгдэн, найдвартай серверт хадгалагдана.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: "Олон талын гэрээ",
    desc: "Нэгээс олон малчин, хуульч, байгууллагын хооронд гэрээ байгуулах боломжтой.",
  },
];

const stats = [
  { value: "500+", label: "Бүртгэлтэй малчин" },
  { value: "1,200+", label: "Байгуулсан гэрээ" },
  { value: "98%", label: "Хэрэглэгчийн сэтгэл ханамж" },
  { value: "24/7", label: "Үйлчилгээний хүртээмж" },
];

function AboutSection() {
  const ref = useReveal();
  return (
    <section className="py-24 bg-white">
      <div
        ref={ref}
        className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center opacity-0 translate-y-8 transition-all duration-700"
      >
        {/* Left: visual */}
        <div className="relative">
          <div className="w-full aspect-square max-w-md mx-auto rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 flex items-center justify-center shadow-2xl">
            <div className="text-center text-white p-10">
              <div className="flex justify-center mb-6">
                <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                  <svg className="w-12 h-12 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-bold text-yellow-300 mb-2">МалГэрээ</p>
              <p className="text-slate-300 text-sm leading-relaxed">
                Монгол малчин, хуульчдын хууль эрхзүйн аюулгүй байдлыг хангах платформ
              </p>
            </div>
          </div>
          {/* Floating badge */}
          {/* <div className="absolute -bottom-4 -right-4 bg-yellow-400 text-slate-900 text-sm font-bold px-5 py-3 rounded-xl shadow-lg">
           Малчдад зориулсан
          </div> */}
        </div>

        {/* Right: text */}
        <div>
          <span className="text-indigo-600 font-semibold text-sm uppercase tracking-widest">Системийн тухай</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
            Малчны хуулийн эрхийг{" "}
            <span className="text-indigo-700">цахимаар хамгаалах</span>
          </h2>
          <p className="mt-5 text-gray-600 text-base leading-relaxed">
            МалГэрээ нь Монголын малчдыг хуулийн мэргэжилтнүүдтэй холбож, гэрээний үйл явцыг хурдан,
            найдвартай, ил тод болгодог цахим платформ юм. Уламжлалт цаасан гэрээний оронд цахим
            гэрээ ашиглан цаг, хөрөнгөө хэмнэ.
          </p>
          <p className="mt-4 text-gray-600 text-base leading-relaxed">
            Бэлчээр ашиглалт, малын худалдаа, ажил хүчний гэрээ зэрэг малчдад хамаатай бүх төрлийн
            гэрээний загварыг манай систем дэмждэг.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <a
              href="/register"
              className="inline-block px-8 py-3.5 bg-indigo-700 text-white font-semibold rounded-full hover:bg-indigo-800 hover:scale-105 transition-all duration-300 shadow-md text-center"
            >
              Бүртгүүлэх
            </a>
            <a
              href="/templates"
              className="inline-block px-8 py-3.5 border-2 border-indigo-700 text-indigo-700 font-semibold rounded-full hover:bg-indigo-50 hover:scale-105 transition-all duration-300 text-center"
            >
              Загварууд харах
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const ref = useReveal();
  return (
    <section className="py-16 bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800">
      <div
        ref={ref}
        className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center opacity-0 translate-y-8 transition-all duration-700"
      >
        {stats.map((s) => (
          <div key={s.label} className="group">
            <p className="text-4xl font-extrabold text-yellow-300 group-hover:scale-110 transition-transform duration-300 inline-block">
              {s.value}
            </p>
            <p className="mt-2 text-slate-300 text-sm">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeaturesSection() {
  const ref = useReveal();
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className="text-center mb-16 opacity-0 translate-y-8 transition-all duration-700"
        >
          <span className="text-indigo-600 font-semibold text-sm uppercase tracking-widest">
            Малчин хуульчдад хэрэгтэй
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-gray-900">
            Яагаад МалГэрээ ашиглах вэ?
          </h2>
          <p className="mt-4 text-gray-500 max-w-xl mx-auto">
            Малчид болон хуулийн мэргэжилтнүүдийн өдөр тутмын хэрэгцээнд нийцсэн
            бүрэн функцлэг платформ.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ icon, title, desc, delay }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 hover:border-indigo-200 transition-all duration-300 opacity-0 translate-y-8"
    >
      <div className="w-14 h-14 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center mb-5 group-hover:bg-indigo-700 group-hover:text-white transition-colors duration-300">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

export default function Introduction() {
  return (
    <div>
      <AboutSection />
      <StatsSection />
      <FeaturesSection />
    </div>
  );
}
