// Import Requirements
const DiscordJS = require('discord.js')
const fs = require('fs')
const path = require('path')
const ytdl = require('ytdl-core')
const YouTubeAPIHandler = require('./youtubeApiHandler')
const mh = require('./messageHandler')

// Init Config Vars
let cfg, helpfile, blacklist, radiolist

// Load Files
try {
  cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'config.json')), 'utf8')
  helpfile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'help.json')), 'utf8')
  blacklist = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'blacklist.json')), 'utf8')
  radiolist = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'radio_playlists.json')), 'utf8')
} catch (err) {
  if (err) throw err
}

// Object Construction
const bot = new DiscordJS.Client()
const yth = new YouTubeAPIHandler(cfg.youtube_api_key)

// Variable Declaration
let voiceConnection, voiceChannel, dispatcher, stream, nowPlaying, prevPlayed, mchannel
let pf = '$'
let songQueue = []
let volume = 0.15
let radioMode = false
let shuffle = false
let lastMsgTimestamp = 0
let state = {
  responseCapture: {
    count: 0,
    handler: undefined
  }
}

function resetResponseCapture () {
  state.responseCapture = {
    count: 0,
    handler: undefined
  }
}

class ResponseCapturer {
  constructor (options) {
    this.msg = options.msg
    this.senderID = options.senderID
    this.senderTag = options.senderTag
    this.timeout = options.timeout
    this.choices = options.choices
    this.onCapture = options.onCapture
  }

  sendMsg (mchannel) {
    let options = {
      embed: {
        title: ':notepad_spiral: ❱❱ SELECTION',
        color: 16580431, // Yellow
        description: `${this.msg}\nType **"quit"** to cancel the response selection.`,
        fields: []
      }
    }

    for (let i = 0; i < this.choices.length; i++) {
      options.embed.fields.push({
        name: `[${i + 1}]`,
        value: this.choices[i]
      })
    }

    mchannel.send(this.senderTag, options)
  }

  registerResult (res) {
    this.onCapture(res - 1)
    clearTimeout(this.timeout)
  }
}

// Init Bot
bot.login(cfg.bot_token)

/*
// Bot Events
*/

// On: Bot ready
bot.on('ready', () => {
  console.log('BOT >> Music Bot started')
  bot.user.setPresence({ game: { name: `v${cfg.version} - By CF12`, type: 0 } })
})

// On: Message Creation
bot.on('message', (msg) => {
  /*
   * TODO: Temporary DJ's
   * TODO: Fix Queue Listings for Radio Mode
   */

  // Cancels messages if user is bot
  if (msg.author.bot) return

  // Response Capturer for user prompts
  if (state.responseCapture.handler) {
    if (state.responseCapture.handler.senderID !== msg.member.id) return

    if (state.responseCapture.count === 3) {
      resetResponseCapture()
      mh.logChannel(mchannel, 'info', 'Cancelling response... [Too many responses]')
      return
    }

    try {
      if (msg.content.toUpperCase() === 'QUIT') {
        resetResponseCapture()
        mh.logChannel(mchannel, 'info', 'Cancelling response...')
        return
      } else if (state.responseCapture.handler.choices[parseInt(msg.content) - 1]) {
        state.responseCapture.handler.registerResult(parseInt(msg.content))
        resetResponseCapture()
        return
      } else {
        state.responseCapture.count++
        mh.logChannel(mchannel, 'err', 'Invalid response! Please use a valid number in your response. Type "quit" if you wish to cancel the prompt')
        return
      }
    } catch (err) {
      if (err) {
        state.responseCapture.count++
        mh.logChannel(mchannel, 'err', 'Invalid response! Please use a valid number in your response. Type "quit" if you wish to cancel the prompt')
        return
      }
    }

    return
  }

  // Cancels messages if no command prefix is detected
  if (!msg.content.startsWith(pf)) return

  // Command variables
  mchannel = msg.channel
  let member = msg.member
  let fullMsgArray = msg.content.split(' ')
  let cmd = fullMsgArray[0].slice(1, fullMsgArray[0].length).toUpperCase()
  let args = fullMsgArray.slice(1, fullMsgArray.length)

  // Command: Help
  if (cmd === 'HELP') {
    let options = {
      title: '',
      description: `[] = **required** arguments, {} = **optional** arguments\nUse **${pf}help [command]** for more details regarding that command. `,
      color: 4322503,
      fields: [],
      footer: {
        text: `v${cfg.version} - Developed By @CF12#1240 - https://github.com/CF12/music-bot`,
        icon_url: 'http://i.imgur.com/OAqzbEI.png'
      }
    }

    if (args.length === 0) {
      options.title = ':grey_question: ❱❱ COMMAND HELP'

      for (let key in helpfile) {
        options.fields.push({
          name: `**${pf}${helpfile[key].format}**`,
          value: helpfile[key].description
        })
      }
    } else if (args.length === 1) {
      let input = args[0].toLowerCase()

      if (!Object.keys(helpfile).includes(input)) return mh.logChannel(mchannel, 'err', `Couldn't find help entry for **${pf}${input}**`)
      else {
        options.title = `:grey_question: ❱❱ COMMAND HELP - ${pf}${input}`
        options.fields = [
          {
            name: 'Usage',
            value: pf + helpfile[input].format
          },
          {
            name: 'Detailed Description',
            value: helpfile[input].long_description
          }
        ]
      }
    }

    mchannel.send({ embed: options })
    return
  }

  // Command: Ping
  if (cmd === 'PING') return mh.logChannel(mchannel, 'info', 'Pong!')

  // Command: Play from YouTube Link
  if (cmd === 'PLAY') {
    if (!member.voiceChannel) return mh.logChannel(mchannel, 'err', 'User is not in a voice channel!')
    if (args.length === 0) return mh.logChannel(mchannel, 'info', 'Adds a YouTube link to the playlist. Usage: *' + pf + 'play [url]*')
    if (args.length > 1) return mh.logChannel(mchannel, 'err', 'Invalid usage! Usage: ' + pf + 'play [url]')
    if (blacklist.users.includes(member.id)) return mh.logChannel(mchannel, 'bl', 'User is blacklisted!')
    if (radioMode) return mh.logChannel(mchannel, 'err', 'Songs cannot be queued while the bot is in radio mode!')
    if (checkCooldown(msg.createdTimestamp, lastMsgTimestamp, member, 5000)) return

    parseYTUrl(args[0])
    .then((data) => {
      function queueTrack (sourceID) {
        addTrack(sourceID, msg.member, false)
          .then(() => {
            if (!voiceConnection) voiceConnect(member.voiceChannel)
            prevPlayed = data.id
          })
          .catch((err) => {
            if (err === 'EMPTY_VID') mh.logChannel(mchannel, 'err', 'This video appears to be invalid / empty. Please double check the URL.')
            else {
              mh.logConsole('err', err)
              mh.logChannel(mchannel, 'err', 'An unknown error has occured while parsing the link through the YouTube API. Please make sure the URL is valid. If all else fails, contact @CF12#1240.')
            }
          })
      }

      function queuePlaylist (sourceID) {
        addPlaylist(sourceID, member)
          .then(() => {
            mh.logChannel(mchannel, 'info', 'Playlist successfully added!')
            if (!voiceConnection) voiceConnect(member.voiceChannel)
            prevPlayed = data.id
          })
          .catch((err) => {
            if (err === 'EMPTY_VID') mh.logChannel(mchannel, 'err', 'This video appears to be invalid / empty. Please double check the URL.')
            else {
              mh.logConsole('err', err)
              mh.logChannel(mchannel, 'err', 'An unknown error has occured while parsing the link through the YouTube API. Please make sure the URL is valid. If all else fails, contact @CF12#1240.')
            }
          })
      }

      switch (data.type) {
        case 'video':
          queueTrack(data.id)
          break
        case 'playlist':
          queuePlaylist(data.id)
          break
        case 'hybrid':
          state.responseCapture = {
            count: 0,
            handler: new ResponseCapturer({
              msg: 'Hybrid Video / Playlist link detected. Please choose the desired action:',
              choices: ['Queue video', 'Queue entire playlist'],
              senderID: member.id,
              senderTag: member.toString(),
              timeout: setTimeout(() => {
                resetResponseCapture()
                mh.logChannel(mchannel, 'info', 'Cancelling response... [Timed out]')
              }, 10000),
              onCapture: (res) => {
                switch (res) {
                  case 0:
                    queueTrack(data.videoID)
                    break
                  case 1:
                    queuePlaylist(data.playlistID)
                    break
                }
              }
            })
          }

          state.responseCapture.handler.sendMsg(mchannel)
          break
        default:
          throw new Error('Invalid queue type')
      }
    })
    .catch((err) => {
      if (err) mh.logChannel(mchannel, 'err', 'Error while parsing URL. Please make sure the URL is a valid YouTube link.')
    })
    return
  }

  // Command: Toggles song shuffling
  if (cmd === 'SHUFFLE') {
    if (args.length > 0) {
      if (['ON', 'TRUE'].includes(args[0].toUpperCase())) shuffle = true
      else if (['OFF', 'FALSE'].includes(args[0].toUpperCase())) shuffle = false
      else return mh.logChannel(mchannel, 'err', `Invalid Arguments! Usage: ${pf + helpfile.shuffle.info.format}`)
    } else shuffle = !shuffle

    if (shuffle) mh.logChannel(mchannel, 'info', `Shuffling is now: **ON**`)
    else mh.logChannel(mchannel, 'info', `Shuffling is now: **OFF**`)
    return
  }

  // Command: Requeue last song
  if (cmd === 'REQUEUE') {
    if (!prevPlayed) return mh.logChannel(mchannel, 'err', 'Previous Queue is empty. Queue something before using this command.')
    if (checkCooldown(msg.createdTimestamp, lastMsgTimestamp, member, 5000)) return
    if (prevPlayed.slice(0, 2) === 'p:') {
      addPlaylist(prevPlayed.slice(2), member)
      .then(() => {
        mh.logChannel(mchannel, 'info', 'Playlist successfully re-queued!')
        if (!voiceConnection) voiceConnect(member.voiceChannel)
      })
    } else {
      addTrack(prevPlayed, member, false)
      .then(() => {
        if (!voiceConnection) voiceConnect(member.voiceChannel)
      })
    }
    return
  }

  // Command: List Song Queue
  if (cmd === 'QUEUE') {
    if (songQueue.length === 0) return mh.logChannel(mchannel, 'info', 'Song Queue:\n```' + 'No songs have been queued yet. Use ' + pf + 'play [YouTube URL] to queue a song.' + '```')

    let firstVideoTitle = songQueue[0].title
    let firstVideoDuration = songQueue[0].duration
    if (firstVideoTitle.length >= 60) firstVideoTitle = firstVideoTitle.slice(0, 55) + ' ...'
    let queue = firstVideoTitle + ' '.repeat(60 - firstVideoTitle.length) + '|' + ' ' + firstVideoDuration + '\n'

    for (let i = 1; i < songQueue.length; i++) {
      let videoTitle = songQueue[i].title
      let videoDuration = songQueue[i].duration

      if (videoTitle.length >= 60) videoTitle = videoTitle.slice(0, 55) + ' ...'
      if (queue.length > 1800) {
        queue = queue + '...and ' + (songQueue.length - i) + ' more'
        break
      }

      queue = queue + videoTitle + ' '.repeat(60 - videoTitle.length) + '|' + ' ' + videoDuration + '\n'
    }

    mh.logChannel(mchannel, 'info', 'Song Queue:\n```' + queue + '```')
    return
  }

  // Command: Skip Song
  if (cmd === 'SKIP') {
    if (!voiceConnection) return mh.logChannel(mchannel, 'err', 'The bot is not playing anything currently! Use **' + pf + 'play [url]** to queue a song.')
    if (radioMode) return mh.logChannel(mchannel, 'err', 'Skip is unavailable in radio mode.')
    if (checkCooldown(msg.createdTimestamp, lastMsgTimestamp, member, 5000)) return

    dispatcher.end()
    return
  }

  // Command: Shows the currently playing song
  if (cmd === 'NP' || cmd === 'NOWPLAYING') {
    if (!voiceConnection) return mh.logChannel(mchannel, 'err', 'The bot is not playing anything currently! Use **' + pf + 'play [url]** to queue a song.')
    mh.logChannel(mchannel, 'musinf', 'NOW PLAYING: **' + nowPlaying.title + ' - [' + nowPlaying.duration + ']** - requested by ' + nowPlaying.requester)
    return
  }

  // Command: Leave Voice Channel
  if (cmd === 'LEAVE') {
    if (!voiceConnection) return mh.logChannel(mchannel, 'err', 'The bot is not in a voice channel!')
    if (radioMode) {
      radioMode = false
      mh.logChannel(mchannel, 'musinf', 'Radio Mode has been toggled to: **OFF**')
    }

    songQueue = []
    dispatcher.end()
    voiceConnection = undefined
    return
  }

  // Command: Volume Control
  if (cmd === 'VOLUME') {
    if (args.length === 0) return mh.logChannel(mchannel, 'info', 'Sets the volume of music. Usage: ' + pf + 'volume [1-100]')
    if (args.length === 1 && args[0] <= 100 && args[0] >= 1) {
      volume = args[0] * 0.005
      if (dispatcher) dispatcher.setVolume(volume)
      mh.logChannel(mchannel, 'vol', 'Volume set to: ' + args[0])
    } else mh.logChannel(mchannel, 'err', 'Invalid usage! Usage: ' + pf + 'volume [1-100]')
    return
  }

  if (cmd === 'RADIO') {
    if (args.length === 0) return mh.logChannel(mchannel, 'info', 'Controls the radio features of the bot. For more info, do: **' + pf + 'radio help**')
    if (args[0].toUpperCase() === 'HELP') return mchannel.send('__Manual page for: **' + pf + 'radio**__\n**' + pf + 'radio help** - Shows this manual page\n**' + pf + 'radio list** - Displays a list of radio stations\n**' + pf + 'radio set [station]** - Sets the radio to the specified station\n**' + pf + 'radio off** - Deactivates the radio')
    if (args[0].toUpperCase() === 'LIST') return mh.logChannel(mchannel, 'radioinf', '**Available Radio Stations:** ' + Object.keys(radiolist))
    if (args[0].toUpperCase() === 'SET') {
      if (args.length === 2) {
        if (voiceConnection) return mh.logChannel(mchannel, 'err', 'Bot cannot be in a voice channel while activating radio mode. Please disconnect the bot by using ' + pf + 'leave.')
        if (!member.voiceChannel) return mh.logChannel(mchannel, 'err', 'User is not in a voice channel!')
        if (!radiolist.hasOwnProperty(args[1].toUpperCase())) return mh.logChannel(mchannel, 'err', 'Invalid station! Use **' + pf + 'radio list** to see a list of all the stations')

        radioMode = true
        mh.logChannel(mchannel, 'radioinf', 'NOW PLAYING: Radio Station - **' + args[1] + '**')
        addPlaylist(radiolist[args[1].toUpperCase()], msg.member)
        .then(() => {
          voiceConnect(member.voiceChannel)
        })

        return
      }

      return mh.logChannel(mchannel, 'err', 'Invalid arguments! Usage: **' + pf + 'radio set [station name]**')
    }

    if (args[0].toUpperCase() === 'OFF') {
      if (args.length === 1) {
        radioMode = false
        mh.logChannel(mchannel, 'radioinf', 'Ending radio stream.')

        songQueue = []
        dispatcher.end()
        voiceConnection = undefined
        return
      }

      return mh.logChannel(mchannel, 'err', 'Invalid arguments! Usage: **' + pf + 'radio off**')
    }

    return mh.logChannel(mchannel, 'err', 'Invalid usage! For help, use **' + pf + 'radio help.** ')
  }

  return mh.logChannel(mchannel, 'err', 'Invalid command! For a list of commands, do: **' + pf + 'help**')
})

/*
// Functions
*/

// Function: Parse YT Url
function parseYTUrl (url) {
  return new Promise((resolve, reject) => {
    if (url.includes('youtube.com') && url.includes('watch?v=') && url.includes('&list=')) {
      resolve({
        type: 'hybrid',
        videoID: url.split('watch?v=')[1].split('#')[0].split('&')[0],
        playlistID: url.split('&list=')[1].split('#')[0].split('&')[0]
      })
    } else if (url.includes('youtube.com') && url.includes('watch?v=')) {
      resolve({
        type: 'video',
        id: url.split('watch?v=')[1].split('#')[0].split('&')[0]
      })
    } else if (url.includes('youtu.be')) {
      resolve({
        type: 'video',
        id: url.split('be/')[1].split('?')[0]
      })
    } else if (url.includes('youtube.com') && url.includes('playlist?list=')) {
      resolve({
        type: 'playlist',
        id: url.split('playlist?list=')[1]
      })
    } else reject('INVALID_LINK')
  })
}

// Function: Adds song to queue
function addTrack (videoID, member, suppress) {
  return new Promise((resolve, reject) => {
    if (blacklist.songs.videos.includes(videoID) && !suppress) return mh.logChannel(mchannel, 'bl', `Sorry, but this video is blacklisted. **[Video ID in Blacklist]**`)

    yth.getVideo(videoID)
    .then((info) => {
      let video = info.items[0]

      for (let keyword of blacklist.songs.keywords) {
        if (video.snippet.title.toUpperCase().includes(keyword.toUpperCase()) && !suppress) return mh.logChannel(mchannel, 'bl', `Sorry, but this video is blacklisted. **[Keyword: ${keyword}]**`)
      }

      songQueue.push({
        video_ID: videoID,
        link: String('http://youtube.com/watch?v=' + videoID),
        requester: member.toString(),
        title: String(video.snippet.title),
        duration: convertDuration(video.contentDetails.duration)
      })

      if (!suppress) mh.logChannel(mchannel, 'info', 'Song successfully added to queue.')
      resolve()
    })

    .catch((err) => {
      reject(err)
    })
  })
}

// Function: Queues an entire playlist
function addPlaylist (playlistID, member) {
  return new Promise((resolve, reject) => {
    if (!radioMode) mh.logChannel(mchannel, 'musinf', 'Fetching playlist information...')

    yth.getPlaylist(playlistID)
    .then((playlist) => {
      if (playlist.length === 0) return mh.logChannel(mchannel, 'err', 'The input playlist is empty. Please queue a non-empty playlist.')

      for (const index in playlist) {
        addTrack(playlist[index].snippet.resourceId.videoId, member, true)
        .then(() => {
          if (playlist[playlist.length - 1] === playlist[index]) resolve()
        })
        .catch((err) => {
          if (err === 'EMPTY_VID') return
          else reject(err)
        })
      }
    })

    .catch((err) => {
      reject(err)
    })
  })
}

// Function: Plays next song
function nextSong () {
  if (radioMode || shuffle) nowPlaying = songQueue[Math.floor(Math.random() * songQueue.length)]
  else nowPlaying = songQueue[0]

  if (!radioMode) {
    mh.logChannel(mchannel, 'musinf', 'NOW PLAYING: **' + nowPlaying.title + ' - [' + nowPlaying.duration + ']** - requested by ' + nowPlaying.requester)
    mh.logConsole('info', 'Now playing: ' + nowPlaying.title)
  }

  stream = ytdl(nowPlaying.link, {quality: 'lowest'})
  dispatcher = voiceConnection.playStream(stream)
  dispatcher.setVolume(volume)
  return dispatcher.on('end', () => {
    if (voiceConnection.channel.members.array().length === 1) return voiceDisconnect(true)
    if (!radioMode) {
      songQueue.shift()
      if (songQueue.length === 0) {
        voiceDisconnect(false)
        return
      }
    }
    dispatcher = nextSong()
    return
  })
}

// Function Connects to Voice Channel
function voiceConnect (channel) {
  voiceChannel = channel
  channel.join()
  .then((connection) => {
    mh.logConsole('info', 'Joining Voice Channel <' + voiceChannel.id + '>')
    voiceConnection = connection
    dispatcher = nextSong()
  })
}

// Function: Disconnect from Voice Channel
function voiceDisconnect (emptyVoice = false) {
  mh.logConsole('info', 'Leaving Voice Channel <' + voiceChannel.id + '>')
  if (!emptyVoice) mh.logChannel(mchannel, 'musinf', 'Queue ended. Disconnecting...')
  else mh.logChannel(mchannel, 'musinf', 'Empty voice channel detected. Disconnecting...')

  voiceConnection.disconnect()
  voiceConnection = undefined
  dispatcher = undefined
}

// Function: Check and return cooldowns between message timestamps
function checkCooldown (currentTime, lastTime, member, cooldown) {
  let diff = currentTime - lastTime
  if (diff <= cooldown) {
    mh.logChannel(mchannel, 'delay', `${member.toString()}, please wait **${cooldown * 0.001 - Math.ceil(diff * 0.001)}** second(s) before using this command again.`)

    return true
  } else {
    lastMsgTimestamp = currentTime
    return false
  }
}

// Function: Convert Durations from ISO 8601
function convertDuration (duration) {
  let reptms = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/
  let hours = 0
  let minutes = 0
  let seconds = 0

  if (reptms.test(duration)) {
    let matches = reptms.exec(duration)
    if (matches[1]) hours = Number(matches[1])
    if (matches[2]) minutes = Number(matches[2])
    if (matches[3]) seconds = Number(matches[3]) - 1
  }

  if (hours >= 1) return (hours < 10 ? '0' + hours : hours) + ':' + (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds)
  if (minutes >= 1) return (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds)
  else return '00:' + (seconds < 10 ? '0' + seconds : seconds)
}
