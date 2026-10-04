// src/utils/mapStyles.js
import L from 'leaflet';

// Generates a random hex color
export const getRandomColor = () => {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

// Returns a Leaflet icon with a random shape (circle, square, triangle)
export const getRandomShapeIcon = (color) => {
  const shapes = ['circle', 'square', 'triangle'];
  const randomShape = shapes[Math.floor(Math.random() * shapes.length)];
  
  return L.divIcon({
    className: `custom-pin ${randomShape}`,
    html: `<div style="background-color: ${color}; width: 100%; height: 100%;"></div>`,
    iconSize: [20, 20], 
    iconAnchor: [10, 10]
  });
};