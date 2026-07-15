import ProductCollectionPage from "./ProductCollectionPage.jsx";
import paintsSpecialty from "../ProductsList/paintsSpecialty.json";

export default function Specialty() {
  return (
    <ProductCollectionPage
      eyebrow="Specialty Series"
      title="Decorative and performance coatings."
      description="Specialty finishes and supporting coating systems for professional decorative and protective applications."
      routeBase="/specialty"
      searchPlaceholder="Search specialty paints..."
      detailHint="Details • finish • system"
      products={paintsSpecialty}
    />
  );
}
