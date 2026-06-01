"use client";

import Image from "next/image";
import { useState } from "react";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";

// ══════════════════════════════════════════════════════════════
// ContractHeroCards — Layered Dynamic Card Swiper
//
// Бизнес зорилго:
//   Hero хэсэгт цахим гэрээний боломжуудыг 3 өөр "scene"-р
//   үзүүлнэ. Active scene дээр hover хийхэд 4 том карт нь
//   фэн хэлбэрээр задарч, 4 текст label буланд нисэн очно.
//   Prev/Next товчоор өөр scene рүү шилждэг.
//
// Технологи:
//   freefrontend.com "Layered Dynamic Card Swiper" pattern-г
//   React state-р зохион байгуулсан хувилбар.
//   Хover transform-ууд container-ын дотор баригдсан (overflow-hidden).
// ══════════════════════════════════════════════════════════════

const DEFAULT_GROUPS = [
  {
    title: "Загвар сонгох",
    bigCards: [
      "/templates/template4.png",
      "/templates/template2.png",
      "/templates/template3.png",
      "/templates/template1.png",
    ],
    labels: ["PDF Export", "QR Verify", "E-Signature", "Авто дугаар"],
  },
  {
    title: "Гарын үсэг зурах",
    bigCards: [
      "/templates/template2.png",
      "/templates/template4.png",
      "/templates/template1.png",
      "/templates/template3.png",
    ],
    labels: ["Тоон үсэг", "OTP баталгаа", "Олон тал", "Цаг хугацаа"],
  },
  {
    title: "Баталгаажуулах",
    bigCards: [
      "/templates/template3.png",
      "/templates/template1.png",
      "/templates/template4.png",
      "/templates/template2.png",
    ],
    labels: ["Blockchain", "QR код", "Аудит лог", "Хадгалалт"],
  },
];

// ── Том картын байрлал (4 ширхэг, fan layout) ──
// Container: 500×500, Card: 230×320. Spread утга нь cards-ыг container
// дотор баригдсан байлгахаар (safe range: translateX -108% … +9%) сонгосон.
// Hover үед scale(0.88) бууруулж corner-ийн rotation-ын бичил overflow-г
// багасгана — ингэснээр layout эвдрэхгүй.
const BIG_CARD_REST = [
  "translate(-85%, -50%) rotate(-10deg)",
  "translate(-55%, -50%) rotate(-3deg)",
  "translate(-45%, -50%) rotate(3deg)",
  "translate(-15%, -50%) rotate(10deg)",
];
const BIG_CARD_SPREAD = [
  "translate(-95%, -45%) rotate(-16deg) scale(0.88)",
  "translate(-68%, -52%) rotate(-6deg)  scale(0.92)",
  "translate(-32%, -52%) rotate(6deg)   scale(0.92)",
  "translate(-5%,  -45%) rotate(16deg)  scale(0.88)",
];

// ── Текст label-ын байрлал (4 ширхэг, өнцгөөр тарна) ──
// Spread жижиг (drift) — chips нь stage-ээс гадагшаа гарахгүй.
const LABEL_POSITIONS = [
  { top: "6%",     left: "4%"  },   // top-left
  { top: "16%",    right: "4%" },   // top-right
  { bottom: "16%", left: "4%"  },   // bottom-left
  { bottom: "6%",  right: "6%" },   // bottom-right
];
const LABEL_REST = [
  "translate(0, 0) rotate(-2deg)",
  "translate(0, 0) rotate(3deg)",
  "translate(0, 0) rotate(-3deg)",
  "translate(0, 0) rotate(2deg)",
];
const LABEL_SPREAD = [
  "translate(-8%,  -18%) rotate(-10deg)",
  "translate(8%,   -22%) rotate(12deg)",
  "translate(-10%,  18%) rotate(10deg)",
  "translate(10%,   18%) rotate(-12deg)",
];

export default function ContractHeroCards({ groups = DEFAULT_GROUPS }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction,   setDirection]   = useState("next"); // 'next' | 'prev'
  const [hovered,     setHovered]     = useState(false);

  const goNext = () => {
    setDirection("next");
    setActiveIndex((i) => (i + 1) % groups.length);
    setHovered(false);
  };
  const goPrev = () => {
    setDirection("prev");
    setActiveIndex((i) => (i - 1 + groups.length) % groups.length);
    setHovered(false);
  };

  const group = groups[activeIndex];

  return (
    <div className="font-forum flex flex-col items-center gap-6">
      {/* ── Stage ── */}
      <div className="relative h-125 w-125 max-w-full overflow-hidden">
        {/* Group swap анимэйшнтай wrapper */}
        <div
          key={activeIndex}
          className={`absolute inset-0
                      ${direction === "next" ? "animate-hero-in-right" : "animate-hero-in-left"}`}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {/* Идэвхтэй scene-ийн title (cards-ын дээр floating chip) */}
          <span
            className="absolute left-1/2 top-2 z-20 -translate-x-1/2
                       rounded-full bg-white/95 px-4 py-1 text-xs font-semibold
                       uppercase tracking-widest text-emerald-700 shadow-lg"
          >
            {group.title}
          </span>

          {/* ── 4 том карт ── */}
          {group.bigCards.map((src, i) => (
            <div
              key={`big-${activeIndex}-${i}`}
              style={{
                transform: hovered ? BIG_CARD_SPREAD[i] : BIG_CARD_REST[i],
                transitionTimingFunction: "cubic-bezier(.05,.43,.25,.95)",
              }}
              className="absolute left-1/2 top-1/2 h-80 w-57.5
                         overflow-hidden border border-white/40 bg-white shadow-2xl
                         transition-transform duration-700 will-change-transform"
            >
              <Image
                src={src}
                alt=""
                fill
                sizes="230px"
                priority={i === 0 && activeIndex === 0}
                className="object-cover"
              />
            </div>
          ))}

          {/* ── 4 текст label ── */}
          {group.labels.map((text, i) => (
            <div
              key={`label-${activeIndex}-${i}`}
              style={{
                ...LABEL_POSITIONS[i],
                transform: hovered ? LABEL_SPREAD[i] : LABEL_REST[i],
                transitionTimingFunction: "cubic-bezier(.05,.43,.25,.95)",
              }}
              className="absolute z-10 whitespace-nowrap rounded-xl border border-white/50
                         bg-white/95 px-4 py-2 text-sm font-semibold text-emerald-800
                         shadow-lg backdrop-blur-sm transition-transform duration-700
                         will-change-transform"
            >
              {text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Swiper навигаци ── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={goPrev}
          aria-label="Өмнөх"
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/60
                     bg-white/10 text-white backdrop-blur-sm transition-all
                     hover:scale-110 hover:bg-white/25 hover:border-white cursor-pointer"
        >
          <MdChevronLeft size={22} />
        </button>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {groups.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setDirection(i > activeIndex ? "next" : "prev");
                setActiveIndex(i);
                setHovered(false);
              }}
              aria-label={`Scene ${i + 1}`}
              className={`h-2 rounded-full transition-all cursor-pointer
                          ${i === activeIndex
                            ? "w-8 bg-white"
                            : "w-2 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label="Дараах"
          className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/60
                     bg-white/10 text-white backdrop-blur-sm transition-all
                     hover:scale-110 hover:bg-white/25 hover:border-white cursor-pointer"
        >
          <MdChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
