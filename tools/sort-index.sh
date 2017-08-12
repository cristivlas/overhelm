#! /usr/bin/env bash

for i in tiles-index/*; do
  echo $i
  sort -u $i > tmp
  mv tmp $i
done
