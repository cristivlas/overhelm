#!/bin/bash
### BEGIN INIT INFO
# Provides:          Ragnar Backend
# Required-Start:    $all
# Required-Stop:     
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Run express service for Ragnar
### END INIT INFO

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/bin

. /lib/init/vars.sh
. /lib/lsb/init-functions
# If you need to source some other scripts, do it here

case "$1" in
  start)
    log_begin_msg "Starting Ragnar service"
    pushd /usr/local/ragnar
    npm start > log.txt 2>&1 & 
    popd
    log_end_msg $?
    exit 0
    ;;
  stop)
    log_begin_msg "Stopping Ragnar"
    # do something to kill the service or cleanup or nothing
    killall -9 node
    log_end_msg $?
    exit 0
    ;;
  *)
    echo "Usage: /etc/init.d/ragnar.sh {start|stop}"
    exit 1
    ;;
esac
