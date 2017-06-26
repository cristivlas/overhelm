const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

function crawl(dir, action) {
  console.log(dir);
  fs.readdir(dir, function(err, list) {
    if (err) {
      return action(err);
    }
    list.forEach(function(file) {
      const path = dir + '/' + file;
      const stat = fs.statSync(path);
      if (stat && stat.isDirectory()) {
        crawl(path, action);
      }
      else {
        action(null, path);
      }
    });
  });
}


const start = path.normalize(__dirname + '/../tiles');
crawl(start, function(err, filePath) {
  if (err) {
    return console.log(err);
  }
  const data = fs.readFileSync(filePath);
  const png = PNG.sync.read(data);
  let isEmpty = true;
  for (let i = 0; i < png.data.length; ++i) {
    if (png.data[i] != 0) {
      isEmpty = false;
      break;
    }
  }
  if (isEmpty) {
    console.log(filePath);
    fs.unlink(filePath, function(err) {
      if (err) {
        console.log(err);
      }
    });
  }
});
 
