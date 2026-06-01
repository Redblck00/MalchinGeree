import Link from "next/link";
import Image from "next/image";
import { FaFacebook, FaInstagram, FaTwitter, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="relative font-serif text-gray-700 bg-emerald-50/40 border-t border-emerald-100">
      {/* ── Top emerald accent bar ────────────────────── */}
      <div className="h-1.5 bg-linear-to-r from-emerald-400 via-emerald-500 to-emerald-700" />

      <div className="container mx-auto px-4 pt-14 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 py-6">

          {/* ── About & Contact ─────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-400 to-emerald-700
                              flex items-center justify-center p-1.5 shadow-sm">
                <Image
                  src="/systemIcon.png"
                  alt="МалчныГэрээ"
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <h3 className="text-xl font-bold text-gray-900 m-0">МалчныГэрээ</h3>
            </div>

            <p className="text-gray-500 text-sm mb-4 leading-relaxed">
              Малчдад зориулсан цахим гэрээний систем
            </p>

            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <FaMapMarkerAlt className="text-emerald-600 shrink-0" />
                <span>Улаанбаатар, Монгол</span>
              </li>
              <li className="flex items-center gap-2">
                <FaPhoneAlt className="text-emerald-600 shrink-0" />
                <a href="tel:+97699001234" className="hover:text-emerald-700 transition-colors">
                  +976 9900-1234
                </a>
              </li>
              <li className="flex items-center gap-2">
                <FaEnvelope className="text-emerald-600 shrink-0" />
                <a href="mailto:info@malchnygeree.mn" className="hover:text-emerald-700 transition-colors">
                  info@malchnygeree.mn
                </a>
              </li>
            </ul>

            <div className="flex gap-3 mt-5">
              <SocialIcon href="#"><FaFacebook size={16} /></SocialIcon>
              <SocialIcon href="#"><FaInstagram size={16} /></SocialIcon>
              <SocialIcon href="#"><FaTwitter size={16} /></SocialIcon>
            </div>
          </div>

          {/* ── Products ───────────────────────────── */}
          <FooterColumn title="Бүтээгдэхүүн">
            <FooterLink href="/templates">Гэрээ үүсгэх</FooterLink>
            <FooterLink href="/templates">Загвар ашиглах</FooterLink>
            <FooterLink href="/dashboard/signature">Гарын үсэг зурах</FooterLink>
          </FooterColumn>

          {/* ── Quick Links ────────────────────────── */}
          <FooterColumn title="Шуурхай холбоос">
            <FooterLink href="/dashboard/profile">Таны бүртгэл</FooterLink>
            <FooterLink href="/dashboard/contracts">Гэрээний түүх</FooterLink>
            <FooterLink href="/templates">Загварууд</FooterLink>
            <FooterLink href="/dashboard">Дашбоард</FooterLink>
          </FooterColumn>

          {/* ── Services ───────────────────────────── */}
          <FooterColumn title="Үйлчилгээ">
            <FooterLink href="/">Тусламжийн төв</FooterLink>
            <FooterLink href="/">Үйлчилгээний нөхцөл</FooterLink>
            <FooterLink href="/">Нууцлалын бодлого</FooterLink>
            <FooterLink href="/">Түгээмэл асуултууд</FooterLink>
          </FooterColumn>
        </div>

        {/* ── Bottom bar ──────────────────────────── */}
        <div className="border-t border-emerald-100 py-5 mt-6
                        flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-500 text-sm m-0">
            © 2025 МалчныГэрээ.
          </p>
          <p className="text-gray-400 text-xs m-0">
            Made with{" "}
            <span className="text-emerald-600">●</span>{" "}
            for Mongolian herders
          </p>
        </div>
      </div>
    </footer>
  );
};

function FooterColumn({ title, children }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-wide">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {title}
      </h3>
      <ul className="space-y-2.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-gray-600 hover:text-emerald-700 transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}

function SocialIcon({ href, children }) {
  return (
    <a
      href={href}
      className="w-9 h-9 rounded-lg bg-white border border-emerald-100
                 text-emerald-600 flex items-center justify-center
                 hover:bg-emerald-600 hover:text-white hover:border-emerald-600
                 transition-colors duration-200 shadow-sm"
    >
      {children}
    </a>
  );
}

export default Footer;
