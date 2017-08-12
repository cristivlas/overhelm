#! /usr/bin/env bash

count=0

for path in tiles/wikimedia/osm-intl/*; do
  file=`basename $path` 
  parts=(${file//./ })
  pat="${parts[2]} ${parts[3]}"
  lkup=`grep "$pat" tiles-index/${parts[1]} 2>/dev/null | head -1`
  if [ "$lkup" ]; then
    echo "$lkup" $path
    let count=$count+1
    rm -f $path 
  fi
done

echo $count files

