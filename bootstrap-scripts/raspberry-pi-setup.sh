#!/bin/bash

# install the various packages and build tools we'll need
sudo apt-get install -y sox python-dev autoconf automake libtool bison pkg-config libpcre3 libpcre3-dev

# download and compile a recent version of swig.
# You can change the version number if there is a newer release
wget -q http://prdownloads.sourceforge.net/swig/swig-3.0.10.tar.gz
tar xf swig-3.0.10.tar.gz
cd swig-3.0.10/
./configure
make
sudo make install
cd ..
rm -r swig-3.0.10 swig-3.0.10.tar.gz

# download and compile a recent version of cmake
# You can change the version number if there is a newer release
wget -q https://cmake.org/files/v3.6/cmake-3.6.0.tar.gz
tar xf cmake-3.6.0.tar.gz
cd cmake-3.6.0
./bootstrap
make
sudo make install
cd ..
rm -r cmake-3.6.0 cmake-3.6.0.tar.gz

# Get Mozilla's version of sphinxbase and build it
$ git clone https://github.com/mozilla/sphinxbase.git
cd sphinxbase
./autogen.sh
make
sudo make install
cd ..

# Get Mozilla's version of pocketsphinx and build it
$ git clone https://github.com/mozilla/pocketsphinx.git
cd pocketsphinx
./autogen.sh
make
sudo make install
cd ..

# Install a recent version of node and npm.
# See https://nodejs.org/en/download/ for latest stable ARM download link
$ wget https://nodejs.org/dist/v4.4.7/node-v4.4.7-linux-armv7l.tar.xz
$ tar xf node-v4.4.7-linux-armv7l.tar.xz
$ cd node-v4.4.7-linux-armv7l/
$ sudo cp -R bin include lib share /usr/local/
$ cd ..
$ rm -r node-v4.4.7-linux-armv7l node-v4.4.7-linux-armv7l.tar.xz

# Install node bindings for cmake
$ sudo npm install -g cmake-js
