import HeroSection from "@/components/home/HeroSection";
import Introduction from "@/components/home/Introduction";
import Footer from "@/components/layout/Footer";
import VisitTracker from "@/components/analytics/VisitTracker";
// Navbar нь root layout.tsx-д mount хийгдсэн — энд дахин оруулахгүй
export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen font-serif bg-white">
      <VisitTracker path="/" />
      <HeroSection />
      <Introduction />
      <Footer />
    </div>
  );
}
