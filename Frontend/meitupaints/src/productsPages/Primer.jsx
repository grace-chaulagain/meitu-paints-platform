import ProductCollectionPage from "./ProductCollectionPage.jsx";
import primerPaints from "../ProductsList/primerPaints.json";

export default function Primer() {
  return (
    <ProductCollectionPage
      eyebrow="Primer Series"
      title="Surface preparation, simplified."
      description="Primer systems that improve adhesion, seal surfaces, and prepare every finish for a cleaner final coat."
      routeBase="/primer"
      searchPlaceholder="Search primers..."
      detailHint="Details • finish • system"
      products={primerPaints}
    />
  );
}
