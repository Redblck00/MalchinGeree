import HeroSection from "@/components/home/HeroSection";
import Introduction from "@/components/home/Introduction";
import React from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import VisitTracker from "@/components/analytics/VisitTracker";
export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen font-serif bg-white">
      <VisitTracker path="/" />
       <Navbar />
      <HeroSection />
      <Introduction />
      <Footer />
    </div>
  );
}
