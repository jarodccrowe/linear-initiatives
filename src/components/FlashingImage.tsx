"use client";

import React, { useState, useEffect } from 'react';

export default function FlashingImage() {
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    const mainInterval = setInterval(() => {
      setShowImage(true);
      setTimeout(() => {
        setShowImage(false);
      }, 50); // Show for 0.05 seconds
    }, 2220000); // Show every 37 minutes

    return () => {
      clearInterval(mainInterval);
    };
  }, []);

  if (!showImage) {
    return null;
  }

  return (
    <img
      src="/image.jpg" // Assumes image.jpg is in the public folder
      alt="Flashing scenic image"
      className="flashing-image-overlay"
    />
  );
}
