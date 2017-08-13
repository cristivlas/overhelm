#! /usr/bin/env bash

for i in tiles/*/*/emptyTiles.txt; do
  echo $i
  dos2unix $i
  sort -u $i > tmp
  mv tmp $i
done
