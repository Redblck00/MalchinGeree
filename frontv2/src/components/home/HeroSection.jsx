"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

export default function HeroSection() {
  const heroRef = useRef(null);

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
      className="relative flex flex-col items-center justify-center text-center font-serif px-6 py-40 min-h-screen overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #0d1b2e 0%, #020617 30%, #000814 58%, #001a3d 80%, #00c8ff 100%)",
        backgroundAttachment: "fixed",
      }}>

      {/* Decorative blobs */}
      <div className="flex flex-col md:flex-row items-center justify-between px-10 py-16 flex-1 max-w-7xl mx-auto w-full gap-10">
{/*  end setion 2  */}
    <div>
      {/* <span className="relative z-10 mb-6 inline-block bg-white/10 border border-white/20 text-purple-200 text-sm font-medium px-5 py-1.5 rounded-full tracking-widest uppercase backdrop-blur-sm">
        Цахим гэрээний систем</span> */}
      {/* Headline */}
      <h1 className="relative z-10 text-5xl md:text-6xl lg:text-6xl font-medium text-white max-w-3xl leading-tight drop-shadow-lg">
        Гэрээгээ{" "}
        <span className="text-transparent bg-clip-text bg-linear-to-r from-yellow-300 to-orange-400">
          хурдан, хялбар
        </span>{" "}
        байгуулаарай
      </h1>

      <p className="relative z-10 mt-6 text-lg md:text-xl text-blue-200 max-w-2xl leading-relaxed">
       Цахим гэрээ нь цахим орчинд талуудын эрх, үүргийг баталгаажуулж, тоон гарын үсэг ашиглан хүчин төгөлдөр болгох гэрээ юм. 
      </p>

      {/* CTAs */}
      <div className="relative z-10 mt-12 flex flex-col sm:flex-row gap-4">
        <Link
          href="/login"
          className="group px-10 py-4 bg-white text-[#020617] font-bold text-base rounded-full shadow-lg hover:bg-[#00c8ff] hover:text-[#020617] hover:shadow-[#00c8ff]/40 hover:scale-105 transition-all duration-300"
        >
          Нэвтрэх
        </Link>
        <Link
          href="/register"
          className="group px-10 py-4 bg-transparent border-2 border-white/60 text-white font-bold text-base rounded-full hover:bg-white/10 hover:border-white hover:scale-105 transition-all duration-300 backdrop-blur-sm"
        >
          Хуулийн мэдлэг
        </Link>
      </div>
    </div>
    {/* right illustration */}
    <div className="relative z-10 hidden lg:block">
         <div className="relative w-80 h-80 shrink-0">
          {/* Background blob */}
          <div className="absolute inset-0 bg-indigo-100 rounded-full opacity-40 scale-110" />

          {/* Puzzle grid */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-3">
              {/* Top-left: filled blue tile */}
              <div className="w-28 h-28 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg relative">
                {/* Puzzle notch bottom */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-blue-600 rounded-full" />
                {/* Puzzle notch right */}
                <div className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 bg-blue-600 rounded-full" />
                <span className="text-white font-extrabold text-3xl z-10">Г</span>
              </div>

              {/* Top-right: outlined tile */}
              <div className="w-28 h-28 border-2 border-gray-300 rounded-2xl flex items-center justify-center shadow-sm relative bg-white">
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 border-2 border-gray-300 rounded-full bg-white" />
                <div className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-8 border-2 border-gray-300 rounded-full bg-white" />
                <span className="text-2xl">📋</span>
              </div>

              {/* Bottom-left: outlined tile */}
              <div className="w-28 h-28 border-2 border-gray-300 rounded-2xl flex items-center justify-center shadow-sm relative bg-white">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 border-2 border-gray-300 rounded-full bg-white" />
                <div className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-8 border-2 border-gray-300 rounded-full bg-white" />
                <span className="text-2xl">✍️</span>
              </div>

              {/* Bottom-right: outlined tile */}
              <div className="w-28 h-28 border-2 border-gray-300 rounded-2xl flex items-center justify-center shadow-sm relative bg-white">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 border-2 border-gray-300 rounded-full bg-white" />
                <div className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-8 border-2 border-gray-300 rounded-full bg-white" />
                <span className="text-2xl">🔔</span>
              </div>
            </div>
          </div>

          {/* Decorative shapes */}
          <div className="absolute top-4 right-0 w-4 h-8 bg-purple-400 rounded-full rotate-12 opacity-70" />
          <div className="absolute bottom-8 left-0 w-6 h-6 bg-yellow-400 rounded-sm rotate-45 opacity-70" />
          <div className="absolute top-1/2 right-4 w-3 h-3 bg-blue-900 rounded-full opacity-80" />
          <div className="absolute bottom-4 right-12 w-3 h-3 bg-orange-400 rounded-full opacity-80" />
        </div>
    </div>
  </div>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-blue-500 opacity-10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-cyan-400 opacity-10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#00c8ff] opacity-5 rounded-full blur-3xl" />
      </div>


      {/* Scroll indicator */}
      <div className="relative z-10 mt-20 flex flex-col items-center gap-2 animate-bounce">
        <span className="text-cyan-300 text-xs tracking-widest uppercase">Доош гүйлгэх</span>
        <svg className="w-5 h-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </section>
  );
}
