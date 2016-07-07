[![Build Status](https://travis-ci.org/mozilla/vaani.client.svg?branch=master)](https://travis-ci.org/mozilla/vaani.client)

Vaani client
------------

This is the front-end application for the Mozilla's Connected Devices project [Vaani local](https://wiki.mozilla.org/Vaani). 

Prerequisites
-----------
- Linux or OSX based system
- nodejs >= 4.0
- [sox] (http://sox.sourceforge.net/)
- [node-pocketsphinx](http://github.com/cmusphinx/node-pocketsphinx) `[sudo] npm install -g pocketsphinx`
- Install Mozilla's custom [sphinxbase](https://github.com/mozilla/sphinxbase) and [pocketsphinx](https://github.com/mozilla/pocketsphinx)
- You'll need a Vaani server running. If you don't have an IP address to one, you can install [Vaani server](https://github.com/mozilla/vaani.server) and run it locally. Just make sure to update the right ip [here](https://github.com/mozilla/vaani.client/blob/master/index.js#L19)  
- Optional [ForeverJs](https://github.com/foreverjs/forever) `[sudo] npm install forever -g`

Installation
-----------
- git clone https://github.com/mozilla/vaani.client
- cd vaani.client
- npm install

Running
----------
- To run with forever `npm run forever`
- To run with standard node `npm start`

Stopping
----------
- `npm run forever-stop`
 
