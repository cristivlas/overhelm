const fs = require('fs');
const execSync = require('child_process').execSync;
const path = require('path');
const PNG = require('pngjs').PNG;


function crawl(dir, action) {
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
    console.log(dir);
    for (let i = 0; i < list.length; ++i) {
      file = list[i];
      const path = dir + '/' + file;
      const stat = fs.statSync(path);
      if (stat && stat.isDirectory()) {
        crawl(path, action);
      }
      else {
        process.stdout.write(dir + ': ' + Math.floor(i * 100 / list.length) + '%  \r');
        action(null, path, emptyList);
      }
    }
    const cmd = 'sort -u ' + emptyList + ' > tmp && mv tmp ' + emptyList;
    try {
      var out = execSync(cmd);
      console.log('Sorted:', emptyList);
    }
    catch (err) {
    };
  });
}


const start = path.normalize(__dirname + '/../tiles');
const index = path.normalize(__dirname + '/../tiles-index');

try {
  fs.mkdirSync(index);
}
catch(err) {
  if (err.code!=='EEXIST') {
    throw new Error(err);
  }
}

crawl(start, function(err, filePath, emptyList) {
  if (err) {
    return console.log(err);
  }
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.png') {
    return;
  }
  let isEmpty = true;
  const data = fs.readFileSync(filePath);
  try {
    const png = PNG.sync.read(data);
    for (let i = 0; i < png.data.length; ++i) {
      if (png.data[i] != 0) {
        isEmpty = false;
        break;
      }
    }
  }
  catch (err) {
    console.log(err.message);
    isEmpty = false;
    fs.unlink(filePath, function(err) {
    });
  }

  const parts = path.basename(filePath).split('.');
  if (isEmpty) {
    const entry = parts[1] + ' ' + parts[2] + ' ' + parts[3] + '\n';
    fs.appendFileSync(emptyList, entry);
    console.log(filePath);

    fs.unlink(filePath, function(err) {
      if (err) {
        console.log(err);
      }
    });
  }
  else if (parts[0] !== 'osm-intl') {
    const indexPath = path.normalize(index + '/' + parts[1]);
    const entry = parts[2] + ' ' + parts[3] + ' ' + parts[0] + '\n';
    fs.appendFileSync(indexPath, entry);
  }
});
 
