# VoiceLogger

Discord Voice Logger Bot

## Quickstart

1. Install [Node.js](https://nodejs.org/) (LTS recommended) and [FFmpeg](https://www.ffmpeg.org/).
2. Clone this repository.
3. Run `npm install` in the repository directory. (In installation, npm will build `@discordjs/opus` and `vosk` module. If you don't have Python 2.7, you need to install it. [Learn more about builds](https://github.com/nodejs/node-gyp#on-windows))
4. [Download voice model from here](https://alphacephei.com/vosk/models) and extract it to `./models` directory. example: `./models/en`. You can edit path in `index.js` (MODEL_PATHS).
5. `cp .env.example .env` and edit `.env` file.
6. Run `npm start` in the repository directory.
7. Invite bot to your server, join voice channel and run `/transcribe start` command.
8. `/transcribe stop` to stop transcribing and you can download transcript.
