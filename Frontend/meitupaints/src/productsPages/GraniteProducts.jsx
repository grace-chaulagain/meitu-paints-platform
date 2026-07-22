import { useLayoutEffect, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import NavBar from "../components/NavBar";
import ProductDetails from "./ProductDetails";
import paints3D from "../ProductsList/paint3D.json";
import paintsLiquid from "../ProductsList/paintsLiquid.json";
import floorPaint from "../ProductsList/floorPaints.json";
import realstonePaints from "../ProductsList/realstonePaints.json";

const allGraniteProducts = [
  ...paints3D,
  ...paintsLiquid,
  ...floorPaint,
  ...realstonePaints,
];

export default function GraniteProducts() {
  const { id } = useParams();
  const location = useLocation();
  const topRef = useRef(null);

  // Prevent the browser from restoring previous scroll position on SPA navigation
  useLayoutEffect(() => {
    try {
      window.history.scrollRestoration = "manual";
    } catch {
      // ignore
    }
  }, []);

  // Always jump to the top on route entry + reload (no animation)
  useLayoutEffect(() => {
    const jumpTop = () => {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      topRef.current?.scrollIntoView?.({ block: "start" });
    };

    jumpTop();
    const raf = requestAnimationFrame(jumpTop);
    const t0 = window.setTimeout(jumpTop, 0);
    const t50 = window.setTimeout(jumpTop, 50);
    const t150 = window.setTimeout(jumpTop, 150);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t0);
      window.clearTimeout(t50);
      window.clearTimeout(t150);
    };
  }, [location.pathname]);

  const product = allGraniteProducts.find((p) => p.id === id);

  if (!product) return null;

  const cat = String(product.category || "").toLowerCase();

  const contextLabel = cat.includes("realstone")
    ? "RealStone Series"
    : cat.includes("floor")
    ? "Floor Paint Series"
    : cat === "3d" || cat.includes("3d")
    ? "3D Granite Series"
    : "Liquid Stone Series";

  return (
    <>
      <div ref={topRef} style={{ height: 0, overflow: "hidden" }} />
      <NavBar />
      <ProductDetails
        product={product}
        backLink="/granite"
        contextLabel={contextLabel}
        heroCaption="Stone-inspired texture. Architectural depth."
        leadText={product.leadtext}
        whyTitle="Why this coating exists"
        whyText="Natural stone finishes are expensive, rigid, and difficult to maintain. This system delivers the same visual impact with improved flexibility and performance."
        benefits={[
          "Authentic stone-like texture",
          "Superior weather resistance",
          "Crack-resistant breathable surface",
          "Ideal for premium façades",
        ]}
        features={product.features}
        detailNote="Recommended for villas, façades, feature walls, and architectural applications."
        warranty={product.warranty}
        nscertified={product.nscertified}
      /></>
  );
}
