import ProductCollectionPage from "./ProductCollectionPage.jsx";
import exteriorPutting from "../ProductsList/exteriorPutting.json";
import interiorPutting from "../ProductsList/interiorPutting.json";
import roadMarking from "../ProductsList/roadmarking.json";

export default function Putting() {
  return (
    <ProductCollectionPage
      eyebrow="Putting Series"
      title="Smooth walls before the finish."
      description="Interior, exterior, and road-marking systems designed for cleaner surfaces and stronger finishing workflows."
      routeBase="/putting"
      searchPlaceholder="Search putting or road marking products..."
      detailHint="Details • sizes • stock"
      categories={[
        { key: "Exterior", label: "Exterior", items: exteriorPutting },
        { key: "Interior", label: "Interior", items: interiorPutting },
        { key: "RoadMarking", label: "Road Marking", items: roadMarking },
      ]}
    />
  );
}
