'use client'
import { useState } from 'react'
import Footer from '@/components/layout/Footer'
import LawHero from '@/components/law/LawHero'
import CategoryTabs from '@/components/law/CategoryTabs'
import PostCard from '@/components/law/PostCard'
import LegalSources from '@/components/law/LegalSources'
import LawCta from '@/components/law/LawCta'
import { CATEGORIES, POSTS } from '@/components/law/lawData'

// ── Хуулийн булан — малчдад зориулсан эрх зүйн влог / нийтлэл ──
// Бүх хэсэг нь components/law/-д тусдаа компонент. Энэ хуудас зөвхөн
// шүүлтүүрийн төлөв удирдаж, компонентуудыг угсарна.
export default function LawPage() {
  const [active, setActive] = useState('Бүгд')

  const filtered =
    active === 'Бүгд' ? POSTS : POSTS.filter((p) => p.category === active)
  const featured = filtered.find((p) => p.featured) || filtered[0] || null
  const rest = filtered.filter((p) => p !== featured)

  return (
    <div className="flex flex-col min-h-screen font-serif bg-white">
      <LawHero />
      <CategoryTabs categories={CATEGORIES} active={active} onChange={setActive} />

      <main className="flex-1 bg-gray-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
          {featured ? (
            <>
              <PostCard post={featured} featured />

              {rest.length > 0 && (
                <>
                  <div className="flex items-baseline justify-between mt-12 sm:mt-16 mb-6">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 m-0">
                      Бүх нийтлэл
                    </h2>
                    <span className="text-sm text-gray-500">{filtered.length} материал</span>
                  </div>
                  <div className="grid gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {rest.map((post, i) => (
                      <PostCard key={post.id} post={post} delay={i * 70} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="border border-gray-200 bg-white p-12 sm:p-16 text-center">
              <p className="text-gray-500 m-0">Энэ ангилалд одоогоор материал алга байна.</p>
            </div>
          )}

          <LegalSources />

          <div className="mt-16 sm:mt-20">
            <LawCta />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
