#!/bin/sh
# Prints the payload received on stdin and the event from the environment.
cat
echo "event=${QUICKDUMP_EVENT}"
echo "decks=${QUICKDUMP_DECKS}"
echo "dump=${QUICKDUMP_DUMP_ID}"
echo "args=$*"
