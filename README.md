# Music Bot
### Music bot is a simple discord bot built on the *Discord.JS API* for discord.

#### **STATUS: STABLE, BUT STILL BEING WORKED ON**

## Features:
 - YouTube Video and Playlist support
 - Extremely fast YouTube API handler
 - Support for "hybrid" YouTube links; Links w/ both a video and playlist id
 - Search support for YouTube Playlists and Videos
 - Dynamic volume control
 - User, Video, and Keyword blacklisting
 - Song Skipping and Repeating
 - "Radio stations" based off of playlists on YouTube

## Planned Features:
 - https://github.com/CF12/music-bot/issues/3

## Prerequisites:
 - Node.JS (Built on v8.2.0)
 - FFPMEG (Must be in path)
 - Discord.JS v11.1.0

## Installation:
### Debian 8 / Ubuntu 16.04 LTS:
##### 1. Install base dependencies:
  ```bash
  sudo apt-get update
  sudo apt-get install git make ffmpeg node-gyp build-essential g++
  ```
##### 2. Install NodeJS:
  - Using `nvm` from https://github.com/creationix/nvm
  - Or download and install from https://nodejs.org/en/download/current/
  - Any version above v7 should work fine, but the bot was programmed based on v8
##### 3. Clone the repo: 
  - `git clone https://github.com/CF12/music-bot`
##### 4. Navigate into the directory: 
  - `cd music-bot`
##### 5. Install NPM dependencies: 
  - `npm i`
##### 6. Setup config:
  - Copy & rename the file for both `config_example.json` and `blacklist_example.json` to `config.json` and `blacklist.json` respectively
  - Fill out the values in `config.json` accordingly to your bot application from https://discordapp.com/developers/applications/me
  - Create an API key for YouTube (https://developers.google.com/youtube/registering_an_application#Create_API_Keys) and use it in the `config.json`
##### 7. Run the bot:
  - `node src/bot.js`
##### 8. Profit?

## Issues?
Please report any bugs or issues under the repo's issues tab. It'd be greatly appreciated!

## Coding Standards
This project uses the Standard JS Coding Style. Most of my Javascript projects are coded with the Standard JS Coding Style.
You can learn more about the project here: https://standardjs.com/

[![JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)
