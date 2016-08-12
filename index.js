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
        if (fs.existsSync(file)) {
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
const Wakeword = require('./wakeword');
const audiotools = require('./audiotools.js');
const servertools = require('./servertools.js');
const leds = require('./ledshelper.js');
const MemoryStream = require('memorystream');
const getMac = require('getmac');

function listen() {

  // variables for the vad
  var streamvad = null;
  var wakeTime = 0;
  var secsSilence = 0;
  var abort;



  const resetlisten = () => {
      if (streamvad){
          streamvad.end();
          streamvad = null;
      }
      Wakeword.resume();
      Wakeword.pause();
      abort = true;
  };

  
  Wakeword.listen([config.wakeword], config.kwscore, config.kwsthreshold, (data, word) => {

        let samples;
        // this block is executed only the first time after the kw get spotted per iteration
        if (!streamvad) {
          leds.processing();
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
          logging.addmetric("userspeech", "end", "ok", 1);
        }
    },
    () => {
        leds.deviceready();
        audiotools.setup(Wakeword, config, logging);
        servertools.setup(Wakeword, config, audiotools, resetlisten, logging);
        getMac.getMac(function(err,macAddress){
            if (err)  console.warn('No Mac');
            logging.setup(macAddress.replace(/:/g,''));
            logging.addmetric("boot", "sucessfull", "ok", 1);
            Wakeword.logging = logging;
        });

    }
  );
}

listen();
