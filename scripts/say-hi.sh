#!/usr/bin/env bash

# Accept a name as argument
NAME=$1

if [ -z "$NAME" ]; then
  NAME="World"
fi

echo "Hi, my name is $NAME"
