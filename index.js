var Wakeword = require('wakeword');
var MemoryStream = require('memorystream');

const MAX_LISTEN_TIME = 5000;
const VAD_BYTES = 640;

function streamToServer(data) {
  // TODO: Send data to server
}

function endStreamToServer() {
  // TODO: Close stream (and listen for result?)
  console.log('Ending stream to server');
}

function vad(data) {
  if (!data) {
    return true;
  }

  // TODO: return false if no activity detected.

  return true;
}

function listen() {
  var stream = null;
  var wakeTime = 0;
  Wakeword.listen(['foxy'], 3000, (data, word, wordData) => {
    if (!stream) {
      wakeTime = Date.now();
      stream = new MemoryStream();
    }

    stream.write(data);

    var samples = stream.read(VAD_BYTES);
    if (samples) {
      streamToServer(samples);
      if (Date.now() - wakeTime > MAX_LISTEN_TIME || !vad(samples)) {
        Wakeword.stop();
        stream.end();
        endStreamToServer();
      }
    }
  });
}

listen();
