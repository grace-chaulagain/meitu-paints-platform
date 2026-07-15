import ProductCollectionPage from "./ProductCollectionPage.jsx";
import exteriorPaints from "../ProductsList/exteriorPaints.json";
import interiorPaints from "../ProductsList/interiorPaints.json";
import distemperPaints from "../ProductsList/distemperPaints.json";

export default function Regular() {
  return (
    <ProductCollectionPage
      eyebrow="Regular Series"
      title="Interior & exterior paints."
      description="Durable everyday paint systems for smooth walls, strong coverage, and long-lasting color consistency."
      routeBase="/regular"
      searchPlaceholder="Search regular paints..."
      detailHint="Details • sizes • stock"
      categories={[
        { key: "Exterior", label: "Exterior", items: exteriorPaints },
        { key: "Interior", label: "Interior", items: interiorPaints },
        { key: "Distemper", label: "Distemper", items: distemperPaints },
      ]}
    />
  );
}
