import React, { useState, useRef, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const touchStartY = useRef(0);
  const containerRef = useRef(null);

  const threshold = 80;

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e) => {
    if (isRefreshing || window.scrollY > 0) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - touchStartY.current;

    if (distance > 0 && distance < 150) {
      setPullDistance(distance);
      setShowIndicator(true);
    }
  };

  const handleTouchEnd = async () => {
    if (isRefreshing) return;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setShowIndicator(false);
        }, 500);
      }
    } else {
      setPullDistance(0);
      setShowIndicator(false);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullDistance, isRefreshing]);

  const rotation = isRefreshing ? 360 : (pullDistance / threshold) * 180;
  const opacity = Math.min(pullDistance / threshold, 1);

  return (
    <div ref={containerRef} className="relative">
      <AnimatePresence>
        {showIndicator && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: opacity, y: Math.min(pullDistance * 0.5, 50) }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-0 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-white rounded-full p-3 shadow-lg">
              <RefreshCw
                className="w-6 h-6 text-blue-600"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: isRefreshing ? "none" : "transform 0.1s ease-out",
                  animation: isRefreshing ? "refresh-spin 1s linear infinite" : "none",
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}