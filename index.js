"use strict";

// first we load the config file
var fs = require('fs');
var config = JSON.parse(process.env.VAANI_CONFIG || fs.readFileSync("config.json"));

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

  Wakeword.listen([config.wakeword], config.kwscore, (data, word) => {

        let samples;

        // this block is executed just the first time after the kw get spotted per iteration
        if (!streamvad) {
          audiotools.greeting();
          servertools.connectServer(Wakeword, audiotools);
          streamvad = new MemoryStream();
          wakeTime = Date.now();
        }

        streamvad.write(data);

        while ((samples = streamvad.read(config.VAD_BYTES))) {
          secsSilence = audiotools.vad(samples);
          servertools.streamToServer(samples);
        }

        if ((Date.now() - wakeTime > config.MAX_LISTEN_TIME) || (secsSilence >=  config.MAX_SIL_TIME)) {
          audiotools.endsound();
          streamvad.end();
          streamvad = null;
          Wakeword.resume();
          Wakeword.pause();
          servertools.endStreamToServer();
        }
    },
    () => {
        audiotools.setup(Wakeword, config);
        servertools.setup(Wakeword, config, audiotools);
    }
  );
}

listen();
