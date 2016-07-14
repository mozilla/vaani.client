#!bin/bash
sudo apt-get install vim iceweasel sox node npm python-dev autoconf automake libtool bison pkg-config libpcre3 libpcre3-dev
wget http://node-arm.herokuapp.com/node_latest_armhf.deb &
wait
echo 'downloaded'
sudo dpkg -i node_latest_armhf.deb
rm node_latest_armhf.deb

wget https://cmake.org/files/v3.4/cmake-3.4.1.tar.gz &
wait
tar -xvzf cmake-3.4.1.tar.gz
cd cmake-3.4.1
sudo ./bootstrap
sudo make
sudo make install

sudo npm install -g cmake-js
cd ..

git clone https://github.com/swig/swig.git
cd swig
./autogen.sh
./configure
make
sudo make install
cd ..

git clone https://github.com/mozilla/sphinxbase.git
cd sphinxbase
./autogen.sh
./configure
make
sudo make install
cd ..

git clone https://github.com/mozilla/pocketsphinx
cd pocketsphinx
./autogen.sh
./configure
make
sudo make install
cd ..

git clone http://github.com/cmusphinx/node-pocketsphinx
cd node-pocketsphinx
npm install
cd ..

git clone https://github.com/mozilla/vaani.client
cd vaani.client
npm install
cd ..