#! /usr/bin/env bash

log=log.txt
let i=0

while read line; do
  lcount=`wc -l ${log} | cut -f1 -d' '`
  if [ $lcount -ge 1000 ]; then
    let i=$i+1
    let i=`expr $i % 10`
    mv ${log} log.$i.txt
  fi
  echo $line >> ${log}
done

