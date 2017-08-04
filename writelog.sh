#! /usr/bin/env bash

log=log.txt
start=`date`
let i=0

echo Running since: $date > $log

while read line; do
  lcount=`wc -l ${log} | cut -f1 -d' '`
  if [ $lcount -ge 5000 ]; then
    let i=$i+1
    let i=`expr $i % 10`
    mv ${log} log.$i.txt
    echo Running since: $date > $log
  fi
  echo $line >> ${log}
done

