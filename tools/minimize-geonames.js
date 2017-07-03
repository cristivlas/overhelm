const geonames = require(__dirname + '/../routes/geonames.json');

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
  
  // workaround for bug in mkgeonames.js
  if (!g.charts
    // and filter some business names we don't care about
    || g.name.includes('Holiday Inn') || g.name.includes('Hilton')
    || g.name.includes('Best Western')
    || g.name.includes('Hotel') || g.name.endsWith(' Spa') 
    || g.name.includes(' Inn ') || g.name.endsWith(' Inn')
    || g.name.includes(' Resort')
    || g.name.includes(' Motel')
    || g.name.endsWith('Church')
    ) {
    console.error(g.name);
    ++i;
    continue;
  }

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
    state: g.state
  });
  i = j;
}
console.log(JSON.stringify(output, null, 4));
