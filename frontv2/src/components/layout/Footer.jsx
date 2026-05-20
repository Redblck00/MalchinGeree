import Link from "next/link";
import { FaFacebook, FaInstagram, FaTwitter, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope } from "react-icons/fa";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 font-serif text-gray-200 pt-12">
      <div className="container mx-auto px-4">

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 py-8">
          {/* About & Contact */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-xl font-bold text-white">🐄 МалГэрээ</h3>
            </div>
            <p className="text-gray-400 text-sm mb-2">Электрон гэрээний систем</p>
            <div className="flex items-center text-gray-400 text-sm mb-2">
              <FaMapMarkerAlt className="mr-2 text-indigo-400" />
              <span>Улаанбаатар, Монгол</span>
            </div>
            <div className="flex items-center text-gray-400 text-sm mb-2">
              <FaPhoneAlt className="mr-2 text-indigo-400" />
              <a href="tel:+97699001234" className="hover:text-indigo-300">+976 9900-1234</a>
            </div>
            <div className="flex items-center text-gray-400 text-sm mb-4">
              <FaEnvelope className="mr-2 text-indigo-400" />
              <a href="mailto:info@malgereе.mn" className="hover:text-indigo-300">info@malgeree.mn</a>
            </div>
            <div className="flex gap-4 mt-4">
              <a href="#" className="hover:text-indigo-400"><FaFacebook size={20} /></a>
              <a href="#" className="hover:text-indigo-400"><FaInstagram size={20} /></a>
              <a href="#" className="hover:text-indigo-400"><FaTwitter size={20} /></a>
            </div>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-indigo-400">•</span> Бүтээгдэхүүн
            </h3>
            <ul className="space-y-2 text-gray-300">
              <li>Гэрээ үүсгэх</li>
              <li>Загвар ашиглах</li>
              <li>Гарын үсэг зурах</li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-indigo-400">•</span> Шуурхай холбоос
            </h3>
            <ul className="space-y-2">
              <li><Link href="/profile" className="text-gray-300 hover:text-indigo-400">Таны бүртгэл</Link></li>
              <li><Link href="/contracts" className="text-gray-300 hover:text-indigo-400">Гэрээний түүх</Link></li>
              <li><Link href="/templates" className="text-gray-300 hover:text-indigo-400">Загварууд</Link></li>
              <li><Link href="/notifications" className="text-gray-300 hover:text-indigo-400">Мэдэгдэл</Link></li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="text-indigo-400">•</span> Үйлчилгээ
            </h3>
            <ul className="space-y-2">
              <li><Link href="/" className="text-gray-300 hover:text-indigo-400">Тусламжийн төв</Link></li>
              <li><Link href="/" className="text-gray-300 hover:text-indigo-400">Үйлчилгээний нөхцөл</Link></li>
              <li><Link href="/" className="text-gray-300 hover:text-indigo-400">Нууцлалын бодлого</Link></li>
              <li><Link href="/" className="text-gray-300 hover:text-indigo-400">Түгээмэл асуултууд</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-white py-6 mt-8">
          <p className="text-gray-400 text-sm text-center">
            © 2025 МалГэрээ. Бүх эрх хуулиар хамгаалагдсан.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
