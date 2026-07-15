import React, { memo, useEffect, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";

const positionOrder = [
  "top-left",
  "top-right",
  "mid-left",
  "mid-right",
  "bottom-left",
  "bottom-right",
  "far-left",
  "far-right",
];

const positionStyles = {
  "top-left": { top: "8%", left: "4%" },
  "top-right": { top: "8%", right: "4%" },
  "mid-left": { top: "38%", left: "6%" },
  "mid-right": { top: "38%", right: "6%" },
  "bottom-left": { top: "68%", left: "4%" },
  "bottom-right": { top: "68%", right: "4%" },
  "far-left": { top: "52%", left: "2%" },
  "far-right": { top: "52%", right: "2%" },
};

const depthValuesByVariant = {
  default: [0.3, 0.35, 0.9, 0.85, 0.4, 0.45, 0.25, 0.2],
  "edge-focus": [0.85, 0.9, 0.3, 0.35, 0.8, 0.85, 0.4, 0.45],
};

const springConfig = { damping: 25, stiffness: 120, mass: 0.28 };

function imageSource(image) {
  return typeof image === "string" ? image : image.src;
}

function imageLabel(image) {
  return typeof image === "string" ? "" : image.label;
}

export default function ParallaxHeroImages({
  images,
  variant = "default",
  className = "",
  imageClassName = "",
}) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const positions = useMemo(() => {
    const limitedImages = images.slice(0, 8);
    const depthValues = depthValuesByVariant[variant] || depthValuesByVariant.default;

    return limitedImages.map((image, index) => ({
      src: imageSource(image),
      label: imageLabel(image),
      position: positionOrder[index],
      depth: depthValues[index],
      delay: index * 0.12,
      priority: index < 3,
    }));
  }, [images, variant]);

  useEffect(() => {
    const handleMouseMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      mouseX.set(x);
      mouseY.set(y);
    };

    const resetMouse = () => {
      mouseX.set(0);
      mouseY.set(0);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", resetMouse);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", resetMouse);
    };
  }, [mouseX, mouseY]);

  return (
    <div
      className={`parallax-hero-images ${className}`.trim()}
      aria-hidden="true"
    >
      {positions.map((item, index) => (
        <ParallaxImage
          key={`${item.src}-${index}`}
          {...item}
          index={index}
          imageClassName={imageClassName}
          smoothMouseX={smoothMouseX}
          smoothMouseY={smoothMouseY}
        />
      ))}
    </div>
  );
}

const ParallaxImage = memo(function ParallaxImage({
  src,
  label,
  position,
  depth,
  delay,
  priority,
  index,
  imageClassName,
  smoothMouseX,
  smoothMouseY,
}) {
  const maxOffset = 42;
  const posStyle = positionStyles[position];
  const translateX = useTransform(
    smoothMouseX,
    [-1, 1],
    [-maxOffset * depth, maxOffset * depth],
  );
  const translateY = useTransform(
    smoothMouseY,
    [-1, 1],
    [-maxOffset * depth, maxOffset * depth],
  );

  return (
    <motion.figure
      className={`parallax-image-card parallax-card-${index + 1}`.trim()}
      style={{
        top: posStyle.top,
        left: posStyle.left,
        right: posStyle.right,
        x: translateX,
        y: translateY,
        zIndex: Math.round(depth * 10) + 1,
      }}
      initial={{ opacity: 0, filter: "blur(18px)", scale: 0.92 }}
      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
      transition={{ duration: 0.82, delay, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <img
        src={src}
        alt=""
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className={imageClassName}
      />
      {label ? <figcaption>{label}</figcaption> : null}
    </motion.figure>
  );
});
