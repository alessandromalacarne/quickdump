#!/bin/sh
# Writes far more than the output limit.
seq 1 20000
seq 1 20000 1>&2
