const bs = require('binarysearch');
const intersect = require('array-intersection');

const states = [
  [ "alabama","al" ],
  [ "alaska","ak" ],
  [ "american samoa","as" ],
  [ "arizona","az" ],
  [ "arkansas","ar" ],
  [ "california","ca" ],
  [ "colorado","co" ],
  [ "connecticut","ct" ],
  [ "delaware","de" ],
  [ "federated states of micronesia","fm" ],
  [ "florida","fl" ],
  [ "georgia","ga" ],
  [ "guam","gu" ],
  [ "hawaii","hi" ],
  [ "idaho","id" ],
  [ "illinois","il" ],
  [ "indiana","in" ],
  [ "iowa","ia" ],
  [ "kansas","ks" ],
  [ "kentucky","ky" ],
  [ "louisiana","la" ],
  [ "maine","me" ],
  [ "marshall islands","mh" ],
  [ "maryland","md" ],
  [ "massachusetts","ma" ],
  [ "michigan","mi" ],
  [ "minnesota","mn" ],
  [ "mississippi","ms" ],
  [ "missouri","mo" ],
  [ "montana","mt" ],
  [ "nebraska","ne" ],
  [ "nevada","nv" ],
  [ "new hampshire","nh" ],
  [ "new jersey","nj" ],
  [ "new mexico","nm" ],
  [ "new york","ny" ],
  [ "north carolina","nc" ],
  [ "north dakota","nd" ],
  [ "northern mariana islands","mp" ],
  [ "ohio","oh" ],
  [ "oklahoma","ok" ],
  [ "oregon","or" ],
  [ "palau","pw" ],
  [ "pennsylvania","pa" ],
  [ "puerto rico","pr" ],
  [ "rhode island","ri" ],
  [ "south carolina","sc" ],
  [ "south dakota","sd" ],
  [ "tennessee","tn" ],
  [ "texas","tx" ],
  [ "us virgin islands","vi" ],
  [ "utah","ut" ],
  [ "vermont","vt" ],
  [ "virginia","va" ],
  [ "washington","wa" ],
  [ "west virginia","wv" ],
  [ "wisconsin","wi" ],
  [ "wyoming","wy" ],
].sort(comp);


function comp(value, find) {
  return value[0].localeCompare(find[0]);
}

Array.prototype.removeEmpty = function() {
  for (let i = 0; i != this.length; ) {
    if (!this[i].length) this.splice(i,1);
    else ++i;
  }
  return this;
}

function findBestMatch(name) {
  const cand = []
  const tok = name.split(' ').removeEmpty();
 
  for (let i = 0; i != tok.length; ++i) {
    cand[i] = []
    for (let j = 0; j != states.length; ++j) {
      const state = states[j][0]
      if (state.includes(tok[i])) {
        cand[i].push(j);
      }
    }
  }
  const res = intersect.apply(null, intersect(cand)); 
  if (res.length) {
    return states[res[0]];
  }
  return null;
}


function findMatch(name) {
  name = name.toLowerCase();
  if (name.length == 2) {
    const val = states.find(function(elem) {
      return elem[1] == name;
    });
    if (val) {
      return val;
    }
  }
  const res = bs(states, [name, ''], comp);
  if (res >= 0) {
     return states[res];
  }
  return findBestMatch(name);
}

module.exports = findMatch;
