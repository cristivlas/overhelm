const geonames = require(__dirname + '/../routes/geonames.json');

geonames.sort(function(a, b) {
  return a.name.localeCompare(b.name);
});

let output = [];

for (let i = 0; i != geonames.length; ) {
  let j = i;
  const g = geonames[i];
  for (; j != geonames.length; ++j) {
    if (g.name !== geonames[j].name) {
      break;
    }
  }
  output.push({
    name: g.name,
    elevation: g.elevation,
    lat: g.lat,
    lon: g.lon,
    state: g.state
  });
  i = j;
}
console.log(JSON.stringify(output, null, 4));
