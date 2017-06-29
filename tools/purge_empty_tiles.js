const fs = require('fs');
const exec = require('child_process').exec;
const path = require('path');
const PNG = require('pngjs').PNG;


function crawl(dir, action) {
  console.log(dir);
  const emptyList = dir + '/emptyTiles.txt';
  if (0) try {
    fs.unlinkSync(emptyList);
  }
  catch (err) {
    console.log(err.message);
  }
  fs.readdir(dir, function(err, list) {
    if (err) {
      return action(err);
    }
    for (let i = 0; i < list.length; ++i) {
      file = list[i];
      const path = dir + '/' + file;
      const stat = fs.statSync(path);
      if (stat && stat.isDirectory()) {
        crawl(path, action);
      }
      else {
        action(null, path, emptyList);
      }
    }
    const cmd = 'sort -n -u ' + emptyList + ' > tmp && mv tmp ' + emptyList;
    exec(cmd, function(err) {
    });
  });
}


const start = path.normalize(__dirname + '/../tiles');

crawl(start, function(err, filePath, emptyList) {
  if (err) {
    return console.log(err);
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.png') {
    return;
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
    const parts = path.basename(filePath).split('.');
    const entry = parts[1] + ' ' + parts[2] + ' ' + parts[3] + '\n';
    fs.appendFileSync(emptyList, entry);
    console.log(filePath);

    fs.unlink(filePath, function(err) {
      if (err) {
        console.log(err);
      }
    });

  }
});
 
