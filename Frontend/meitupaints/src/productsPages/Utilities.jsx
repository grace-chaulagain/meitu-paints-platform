import ProductCollectionPage from "./ProductCollectionPage.jsx";
import paintUtilities from "../ProductsList/paintsUtilities.json";

export default function Utilities() {
  return (
    <ProductCollectionPage
      eyebrow="Utilities Series"
      title="Tools that keep work moving."
      description="Painting tools, rollers, accessories, and utility products arranged for quick selection and ordering."
      routeBase="/utilities"
      searchPlaceholder="Search tools and utilities..."
      detailHint="Details • utility • support"
      products={paintUtilities}
    />
  );
}
