/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const fs = require('fs');
const logging = require('./logging');

const configLoader = function () {
    var config = {}, obj;
    Array.prototype.slice.call(arguments, 0).forEach(file => {
        console.log(file);
        if (fs.exists(file)) {
            try {
                obj = JSON.parse(fs.readFileSync(file));
            } catch (ex) {
                console.error('Problem reading configuration file: ' + file);
            }
            for (var key in obj) {
                config[key] = obj[key];
            }
        }
    });
    return config;
};

// first we load the config file
var config = configLoader('config.json', '.vaanirc');

// then all required modules
const Wakeword = require('wakeword');
const audiotools = require('./audiotools.js');
const servertools = require('./servertools.js');
const MemoryStream = require('memorystream');

function listen() {

  // variables for the vad
  var streamvad = null;
  var wakeTime = 0;
  var secsSilence = 0;
  var abort;

  logging.setup('77287273737');

  const resetlisten = () => {
      if (streamvad){
          streamvad.end();
          streamvad = null;
      }
      Wakeword.resume();
      Wakeword.pause();
      abort = true;
  };

  Wakeword.listen([config.wakeword], config.kwscore, (data, word) => {

        let samples;
        // this block is executed just the first time after the kw get spotted per iteration
        if (!streamvad) {
          audiotools.greeting();
          servertools.connectServer(Wakeword, audiotools);
          streamvad = new MemoryStream();
          wakeTime = Date.now();
          abort = false;
        }

        streamvad.write(data);

        while ((samples = streamvad.read(config.VAD_BYTES))) {
          secsSilence = audiotools.vad(samples);
          servertools.streamToServer(samples);
        }

        if ((Date.now() - wakeTime > config.MAX_LISTEN_TIME) || (secsSilence >=  config.MAX_SIL_TIME) || abort) {
          audiotools.endsound();
          resetlisten();
          servertools.endStreamToServer();
        }
    },
    () => {
        logging.addmetric("boot", "sucessfull", "ok", 1);
        audiotools.setup(Wakeword, config);
        servertools.setup(Wakeword, config, audiotools, resetlisten);
    }
  );
}

listen();
