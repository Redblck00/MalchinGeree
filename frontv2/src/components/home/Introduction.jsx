"use client";
import Image from "next/image";
import { useEffect, useRef } from "react";
import useAuthStore from "@/app/store/authStore";

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

const livestockGallery = [
  { src: "/home/livestock1.png", label: "Хонь",  desc: "Малын худалдааны гэрээ" },
  { src: "/home/livestock2.png", label: "Ямаа",  desc: "Ноолуурын борлуулалт" },
  { src: "/home/livestock3.png", label: "Үхэр",  desc: "Бэлчээр, тэжээлийн гэрээ" },
  { src: "/home/Livestock4.png", label: "Адуу",  desc: "Хамтын ажиллагаа" },
];

function AboutSection() {
  const ref = useReveal();
  const { isAuthenticated, restoreAuth } = useAuthStore();
  useEffect(() => { restoreAuth() }, [restoreAuth]);
  return (
    <section className="py-24 bg-white">
      <div
        ref={ref}
        className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center opacity-0 translate-y-8 transition-all duration-700"
      >
        {/* Left: visual — KPI-style emerald card */}
        <div className="relative">
          <div className="relative w-full aspect-square max-w-md mx-auto rounded-2xl
                          overflow-hidden shadow-2xl
                          bg-linear-to-br from-emerald-400 via-emerald-500 to-emerald-700
                          flex items-center justify-center">
            {/* Decorative circles */}
            <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10" />
            <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-white/5" />

            <div className="relative text-center text-white p-10">
              <div className="flex justify-center mb-6">
                <div className="w-28 h-28 bg-white/20 backdrop-blur-sm rounded-full
                                flex items-center justify-center border border-white/30 p-3">
                  <Image
                    src="/systemIcon.png"
                    alt="МалчныГэрээ"
                    width={88}
                    height={88}
                    className="object-contain"
                  />
                </div>
              </div>
              <p className="text-3xl font-bold text-white mb-2">МалчныГэрээ</p>
              <p className="text-emerald-50 text-sm leading-relaxed max-w-xs mx-auto">
                Монгол малчдын хууль эрхзүйн аюулгүй байдлыг хангах
                цахим гэрээний платформ
              </p>
            </div>
          </div>
        </div>

        {/* Right: text */}
        <div>
          <span className="text-emerald-600 font-semibold text-sm uppercase tracking-widest">
            Системийн тухай
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">
            Малчны хуулийн эрхийг{" "}
            <span className="text-emerald-700">цахимаар хамгаалах</span>
          </h2>
          <p className="mt-5 text-gray-600 text-base leading-relaxed">
            МалчныГэрээ нь Монголын малчдыг хуулийн мэргэжилтнүүдтэй холбож, гэрээний үйл явцыг хурдан,
            найдвартай, ил тод болгодог цахим платформ юм. Уламжлалт цаасан гэрээний оронд цахим
            гэрээ ашиглан цаг, хөрөнгөө хэмнэ.
          </p>
          <p className="mt-4 text-gray-600 text-base leading-relaxed">
            Бэлчээр ашиглалт, малын худалдаа, ажил хүчний гэрээ зэрэг малчдад хамаатай бүх төрлийн
            гэрээний загварыг манай систем дэмждэг.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            {!isAuthenticated && (
              <a
                href="/register"
                className="inline-block px-8 py-3.5 bg-emerald-600 text-white font-semibold
                           rounded-full hover:bg-emerald-700 hover:scale-105
                           transition-all duration-300 shadow-md text-center"
              >
                Бүртгүүлэх
              </a>
            )}
            <a
              href="/templates"
              className="inline-block px-8 py-3.5 border-2 border-emerald-600 text-emerald-700
                         font-semibold rounded-full hover:bg-emerald-50 hover:scale-105
                         transition-all duration-300 text-center"
            >
              Загварууд харах
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function LivestockGallerySection() {
  const ref = useReveal();
  return (
    <section className="py-24 bg-emerald-50/50">
      <div className="max-w-6xl mx-auto px-6">
        <div
          ref={ref}
          className="text-center mb-12 opacity-0 translate-y-8 transition-all duration-700"
        >
          <span className="text-emerald-600 font-semibold text-sm uppercase tracking-widest">
            Малын төрөл
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-gray-900">
            Малчдад зориулсан бүхий л төрлийн гэрээ
          </h2>
          <p className="mt-4 text-gray-500 max-w-2xl mx-auto">
            Хонь, ямаа, үхэр, адуу — таны малын төрөл бүрд тохирсон гэрээний загвар.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {livestockGallery.map((item, i) => (
            <LivestockCard key={item.label} src={item.src} alt={item.label} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  );
}

function LivestockCard({ src, alt, delay }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className="group relative overflow-hidden rounded-2xl shadow-md
                 aspect-4/3
                 hover:shadow-2xl hover:-translate-y-1
                 transition-all duration-300 opacity-0 translate-y-8"
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 640px) 100vw, 50vw"
        className="object-cover group-hover:scale-105 transition-transform duration-500"
      />
    </div>
  );
}

function StatsSection() {
  const ref = useReveal();
  return (
    <section className="relative overflow-hidden py-16
                        bg-linear-to-br from-emerald-400 via-emerald-500 to-emerald-700">
      {/* Decorative circles */}
      <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-white/10" />
      <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-white/5" />

      <div
        ref={ref}
        className="relative max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8
                   text-center opacity-0 translate-y-8 transition-all duration-700"
      >
        {stats.map((s) => (
          <div key={s.label} className="group">
            <p className="text-4xl font-extrabold text-white group-hover:scale-110
                          transition-transform duration-300 inline-block drop-shadow-md">
              {s.value}
            </p>
            <p className="mt-2 text-emerald-50 text-sm">{s.label}</p>
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
          <span className="text-emerald-600 font-semibold text-sm uppercase tracking-widest">
            Малчин хуульчдад хэрэгтэй
          </span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold text-gray-900">
            Яагаад МалчныГэрээ ашиглах вэ?
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
      className="group bg-white rounded-2xl p-8 shadow-sm border border-gray-100
                 hover:shadow-xl hover:-translate-y-1 hover:border-emerald-200
                 transition-all duration-300 opacity-0 translate-y-8"
    >
      <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-xl
                      flex items-center justify-center mb-5
                      group-hover:bg-emerald-600 group-hover:text-white
                      transition-colors duration-300">
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
      <LivestockGallerySection />
      <StatsSection />
      <FeaturesSection />
    </div>
  );
}
