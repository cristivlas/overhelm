const layers = require(__dirname + '/../routes/noaa-layers.json');
const metadata = require(__dirname + '/../routes/noaa-metadata.json').metadata;

function tilesetInfo(t) {
  const md = metadata[t.ident.split('_')[0]];
  let sounding = null;
  let scale = 100000000;
  let poly = null;
  if (md) {
    sounding = md.sounding;
    for (let i = 0; i != md.extent.length; ++i) {
      if (md.extent[i].name===t.ident) {
        poly = md.extent[i].poly;
        scale = md.extent[i].scale;
        break;
      }
    }
  }
  return {
    ident: t.ident,
    sounding: sounding,
    scale: scale,
    lower: t.lower,
    upper: t.upper,
    poly: poly
  };
}


let sets = [];
layers.map(function(t) {
  sets.push(tilesetInfo(t));
});
const result = JSON.stringify(sets, null, 2);
console.log(result);

