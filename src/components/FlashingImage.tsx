"use client";

import React, { useState, useEffect } from 'react';

export default function FlashingImage() {
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    const mainInterval = setInterval(() => {
      setShowImage(true);
      console.log("showing image");
      setTimeout(() => {
        setShowImage(false);
      }, 1000);
    }, 180000);

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
