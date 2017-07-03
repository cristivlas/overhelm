const geonames = require(__dirname + '/geonames.json');

geonames.sort(function(a, b) {
  if (a.state < b.state) {
    return -1;
  }
  if (a.state > b.state) {
    return 1;
  }
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
    if (g.state !== geonames[j].state) {
      break;
    }
  }
  output.push({
    name: g.name,
    elevation: g.elevation,
    lat: g.lat,
    lon: g.lon,
    state: g.state,
    code: g.code
  });
  i = j;
}
console.error(output.length);
console.log(JSON.stringify(output));
