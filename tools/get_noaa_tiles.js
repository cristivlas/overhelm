'use strict';

const charts = require('../routes/noaa-layers.json');
const maxBatchSize = 100;

// http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
function long2tile(lon,zoom) {
  return (Math.floor((lon+180)/360*Math.pow(2,zoom)));
}


function lat2tile(lat,zoom)  {
  return (Math.floor((1-Math.log(Math.tan(lat*Math.PI/180) 
    + 1/Math.cos(lat*Math.PI/180))/Math.PI)/2 *Math.pow(2,zoom)));
}


function lower_tile(zoom, chart) {
  return {
    x: long2tile(chart.lower[0], zoom),
    y: lat2tile(chart.lower[1], zoom),
  }
}


function upper_tile(zoom, chart) {
  return {
    x: long2tile(chart.upper[0], zoom),
    y: lat2tile(chart.upper[1], zoom),
  }
}


const zoom = process.argv[2] || 12;

for (var i = 0; i < charts.length; ++i) {
  const c = charts[i];
  console.log(c.ident);
  let tiles = [];

  const lower = lower_tile(zoom, c);
  const upper = upper_tile(zoom, c);
  const xMin = Math.min(lower.x, upper.x);
  const xMax = Math.max(lower.x, upper.x);
  const yMin = Math.min(lower.y, upper.y);
  const yMax = Math.max(lower.y, upper.y);

  for (let x = xMin; x < xMax; ++x) {
    for (let y = yMin; y < yMax; ++y) {
      tiles.push(zoom + '/' + x + '/' + y);
      if (tiles.length >= maxBatchSize) {
        console.log(tiles);
        tiles = [];
      }
    }
  }
}


