
const fs = require('fs');
const xml2js = require('xml2js');

const parser = new xml2js.Parser();
//
// TODO: download this from NOAA on the fly and remove from GIT
//
const file = 'RNCProdCat_19115.xml';

let metadata = {}

function toJSON(file) {
  fs.readFile(file, function(err, data) {
    if (err) {
      throw(err);
    }
    parser.parseString(data, function(err, result) {
      if (err) {
         throw(err);
      }
      const composedOf = result.DS_Series.composedOf;
      composedOf.map(processComposedOf);
      console.log(JSON.stringify({
        source: file,
        tool: 'get_noaa_metadata.js',
        metadata: metadata,
      } , null, 2));
    });
  })
}


function processComposedOf(elem) {
  const md = elem.DS_DataSet[0].has[0].MD_Metadata[0];
  let info = {}
  processIdentificationInfo(md.identificationInfo[0].MD_DataIdentification[0], info);
  processReferenceSystemInfo(md.referenceSystemInfo, info);
  metadata[info.id] = info;
}


function processIdentificationInfo(ii, info) {
  const citation = ii.citation[0].CI_Citation[0];
  info.id = citation.title[0]['gco:CharacterString'][0];
  info.title = citation.alternateTitle[0]['gco:CharacterString'][0];
  //TODO: dates?  
  processExtent(ii.extent, info);
}


function findChild(obj, name) {
  for (let k in obj) {
    if (k===name) {
      return obj[name];
    }
    else if (typeof obj[k] === 'object') {
      const child = findChild(obj[k], name);
      if (child) {
        return child;
      }
    }
  }
  return null;
}


function processExtent(ex, info) {
  info.extent = [];
  for(let i = 0; i != ex.length; ++i) {
    const extent = ex[i].EX_Extent[0];
    info.extent[i] = {};
    const desc = extent.description[0]['gco:CharacterString'][0].split(';');
    for (let j = 0; j != desc.length; ++j) {
      const attr = desc[j].split(':');
      if (attr[0].trim()==='file name') {
        info.extent[i].name = attr[1].split('.')[0].trim();
      }
      if (attr[0].trim()==='scale') {
        info.extent[i].scale = parseInt(attr[1].trim());
      }
    }
    const linearRing = findChild(extent, 'gml:LinearRing');
    if (linearRing) {
      info.extent[i].poly = [ ];
      linearRing[0]['gml:pos'].map(function(coord) {
        const latLon = coord.split(' ')
        info.extent[i].poly.push([latLon[0], latLon[1]])
      })
    }
  }
}


function processReferenceSystemInfo(rsi, info) {
  for (let i = 0; i != rsi.length; ++i) {
    const ident = rsi[i].MD_ReferenceSystem[0].referenceSystemIdentifier[0].RS_Identifier[0];
    try {
      const space = ident.codeSpace[0]['gco:CharacterString'][0];
      const code = ident.code[0]['gco:CharacterString'][0];
      if (space.match(/Sounding Unit/)) {
        info.sounding = code;
      }
    }
    catch (err) {
    }
  }
}


toJSON(file);

