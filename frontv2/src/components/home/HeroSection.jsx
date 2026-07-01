"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import useAuthStore from "@/app/store/authStore";
import ContractHeroCards from "../ContractHeroCards/page";
export default function HeroSection() {
  const heroRef = useRef(null);
  const { isAuthenticated, restoreAuth } = useAuthStore();

  useEffect(() => { restoreAuth() }, [restoreAuth]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onScroll = () => {
      const scrollY = window.scrollY;
      el.style.backgroundPositionY = `${scrollY * 0.4}px`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative flex flex-col items-center justify-center text-center font-serif px-6 pt-32 pb-20 min-h-screen overflow-hidden
                 bg-linear-to-br from-emerald-400 via-emerald-500 to-emerald-700"
    >
      {/* ── Decorative circles (KPI card style) ────────── */}
      <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-white/10" />
      <div className="absolute -right-10 top-40 w-64 h-64 rounded-full bg-white/5" />
      <div className="absolute -left-24 bottom-10 w-80 h-80 rounded-full bg-white/10" />
      <div className="absolute left-1/3 -bottom-10 w-56 h-56 rounded-full bg-white/5" />

      {/* ── Main 2-column hero ────────────────────────── */}
      <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between
                      px-4 py-16 flex-1 max-w-7xl mx-auto w-full gap-12">

        {/* Left: text + CTAs */}
        <div className="text-left flex-1">
          <span className="inline-block mb-6 px-5 py-1.5 
                           bg-white/20 backdrop-blur-sm border border-white/30
                           text-white/95 text-xs font-medium tracking-widest uppercase">
            Цахим гэрээний систем
          </span>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white
                         leading-[1.1] drop-shadow-lg">
            Гэрээгээ{" "}
            <span className="block text-emerald-100">
              хурдан, хялбар
            </span>
            байгуулаарай
          </h1>

          <p className="mt-6 text-lg md:text-xl text-white/90 max-w-xl leading-relaxed">
            Малчны зориулсан цахим гэрээний систем — талуудын эрх, үүргийг
            баталгаажуулж, тоон гарын үсэг ашиглан хүчин төгөлдөр болгоно.
          </p>

          {!isAuthenticated && (
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/login"
                className="px-8 py-2 bg-white\50 text-emerald-700 font-bold text-base
                           rounded-sm shadow-lg hover:bg-emerald-50 hover:scale-105
                           transition-all duration-300"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/register"
                className="px-8 py-2 bg-transparent border-2 border-white/60 text-white
                           font-bold text-base rounded-full hover:bg-white/10 hover:border-white
                           hover:scale-105 transition-all duration-300 backdrop-blur-sm"
              >
                Бүртгүүлэх
              </Link>
            </div>
          )}
        </div>

        {/* Right: documentIlustrator */}
        <div className="relative flex-1 flex items-center justify-center">
          {/* <div className="relative w-full max-w-md aspect-square">
     
            <div className="absolute inset-0 bg-white/20 rounded-full blur-3xl scale-90" />
            <Image
              src="/home/documentIlustrator.png"
              alt="Document illustration"
              fill
              priority
              className="relative object-contain drop-shadow-2xl"
              sizes="(max-width: 1024px) 80vw, 480px"
            />
          </div> */}

          <ContractHeroCards  cards={[
    "/template/template1.png",
    "/template/template2.png",
    "/template/template3.png",
    "/template/template4.png",
  ]} />
        </div>
      </div>

      {/* ── Scroll indicator ─────────────────────────── */}
      <div className="relative z-10 mt-8 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-white/90 text-xs tracking-widest uppercase">
          Доош гүйлгэх
        </span>
        <svg className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}
