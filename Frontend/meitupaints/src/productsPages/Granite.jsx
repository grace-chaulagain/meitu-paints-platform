import ProductCollectionPage from "./ProductCollectionPage.jsx";
import paints3D from "../ProductsList/paint3D.json";
import paintsLiquid from "../ProductsList/paintsLiquid.json";
import floorPaints from "../ProductsList/floorPaints.json";
import realstonePaints from "../ProductsList/realstonePaints.json";

export default function Granite() {
  return (
    <ProductCollectionPage
      eyebrow="Granite Series"
      title="Stone finishes with architectural depth."
      description="Texture systems, floor coatings, and real-stone inspired finishes arranged for clean product selection."
      routeBase="/granite"
      searchPlaceholder="Search granite, floor, or real stone products..."
      detailHint="Details • finish • system"
      categories={[
        { key: "3D", label: "3D Paints", items: paints3D },
        { key: "Liquid", label: "2D Paints", items: paintsLiquid },
        { key: "Floor", label: "Floor Paints", items: floorPaints },
        { key: "RealStone", label: "Real Stone", items: realstonePaints },
      ]}
    />
  );
}
