#! /usr/bin/env bash

count=0

for path in tiles/wikimedia/osm-intl/*; do
  file=`basename $path` 
  echo $file
  parts=(${file//./ })
  pat="${parts[2]} ${parts[3]}"
  echo $pat > tmp
  lkup=`grep -f tmp tiles-index/${parts[1]} 2>/dev/null | head -1`
  if [ "$lkup" ]; then
    let count=$count+1
    echo "$lkup" $path $count
    rm -f $path 
  fi
done

echo $count files

