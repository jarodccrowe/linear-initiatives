"use client";

import React, { useState, useEffect, useRef } from 'react';

const andyImages = [
  "/andy/16DDF6C1-C2AB-4C8A-8D9F-FCC26B1B091D.jpeg",
  "/andy/28fbcb72-600f-48f1-8a03-f8112aba7505.jpg",
  "/andy/88309F79-E92C-4249-A2C9-024FA40D45A7_1_201_a.jpeg",
  "/andy/ChatGPT Image Apr 15, 2025 at 01_21_49 PM.png",
  "/andy/ChatGPT Image Apr 15, 2025 at 12_00_03 PM (1).png",
  "/andy/DA2D12DC-4B9D-49F3-AF91-AF7EC0A154AA.jpeg",
  "/andy/Screenshot 2023-11-07 at 8.55.40 am.png",
  "/andy/image.jpg",
  "/andy/image.png",
  "/andy/wolverandy.png",
  "/andy/luke.png"
];

export default function FlashingImage() {
  const [currentImage, setCurrentImage] = useState<string>("");
  const [showImage, setShowImage] = useState<boolean>(false);

  const currentImageRef = useRef(currentImage);
  useEffect(() => {
    currentImageRef.current = currentImage;
  }, [currentImage]);

  useEffect(() => {
    let visibilityTimeoutId: NodeJS.Timeout | undefined;

    const pickAndSetNewImage = () => {
      if (andyImages.length === 0) return;
      let randomIndex;
      let newImage;
      do {
        randomIndex = Math.floor(Math.random() * andyImages.length);
        newImage = andyImages[randomIndex];
      } while (andyImages.length > 1 && newImage === currentImageRef.current); // Use ref for up-to-date comparison
      setCurrentImage(newImage);
    };

    // Pre-select an image so it's ready for the first flash, but don't show it.
    if (andyImages.length > 0) {
      const initialRandomIndex = Math.floor(Math.random() * andyImages.length);
      setCurrentImage(andyImages[initialRandomIndex]);
    }

    const mainIntervalId = setInterval(() => {
      if (andyImages.length > 0) { // Ensure andyImages is not empty before proceeding
        pickAndSetNewImage();
        setShowImage(true);

        if (visibilityTimeoutId) {
          clearTimeout(visibilityTimeoutId);
        }
        visibilityTimeoutId = setTimeout(() => {
          setShowImage(false);
        }, 1000); // Show for 1 second
      }
    }, 180000); // Repeat every 3 minutes

    return () => {
      clearInterval(mainIntervalId);
      if (visibilityTimeoutId) {
        clearTimeout(visibilityTimeoutId);
      }
    };
  }, []); // Main effect runs only once on mount

  if (!showImage || !currentImage) {
    return null;
  }

  return (
    <img
      src={currentImage}
      alt="Random Andy Image"
      className="flashing-image-overlay"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        maxWidth: '80vw',
        maxHeight: '80vh',
        zIndex: 9999,
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        opacity: 0.7
      }}
    />
  );
}
