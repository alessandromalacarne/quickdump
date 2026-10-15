#!/bin/sh
# Prints the payload received on stdin and the event from the environment.
cat
echo "event=${QUICKDUMP_EVENT}"
echo "tags=${QUICKDUMP_TAGS}"
echo "dump=${QUICKDUMP_DUMP_ID}"
echo "args=$*"
