// Public + dashboard templates — card grid (responsive breakpoints).
//
// Mobile (< sm): 1 col → card төвлөрсөн, утас бүрт ижил харагдана
// sm  (≥640px): 2 col
// md  (≥768px): 3 col
// lg  (≥1024px): 4 col
//
// justify-items-center — cell дотор card-ыг төв байрлуулна (картын
// max-w-52.5 нь cell-ээс жижиг үед margin тэгшинэ).
export const TEMPLATE_CARD_GRID =
  'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 justify-items-center'
