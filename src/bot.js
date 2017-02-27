// Import Requirements
const DiscordJS = require('discord.js')
const fs = require('fs')
const path = require('path')
const ytdl = require('ytdl-core')
const YouTubeAPIHandler = require('./youtubeapihandler')
const mh = require('./messagehandler')

// Load Files
try {
  var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'config.json')), 'utf8')
  var helpfile = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'help.json')), 'utf8')
  var blacklist = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'blacklist.json')), 'utf8')
  var radiolist = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'radio_playlists.json')), 'utf8')
} catch (err) {
  if (err) throw err
}

// Object Construction
const bot = new DiscordJS.Client()
const yth = new YouTubeAPIHandler(cfg.youtube_api_key)

// Variable Declaration
let pf = '$'
let voiceConnection
let voiceChannel
let dispatcher
let songQueue = []
let volume = 0.15
let mchannel
let radioMode = false
let shuffle = false
let stream
let nowPlaying
let prevPlayed
let lastMsgTimestamp = 0

// Init Bot
bot.login(cfg.bot_token)

/*
// Bot Events
*/

// On: Bot ready
bot.on('ready', () => {
  console.log('BOT >> Music Bot started')
  bot.user.setGame('v1.5.4 - By CF12')
})

// On: Message Creation
bot.on('message', (msg) => {
  /*
   * TODO: Repeats
   * TODO: Temporary DJ's
   * TODO: Confirm proper durations on videos
   * TODO: Add radios
   * TODO: Redo Queue Listings
   * TODO: Fix Queue Listings for Radio Mode
   */

  // Cancels messages without pf or user is a bot
  if (msg.author.bot || !msg.content.startsWith(pf)) return

  // Command variables
  mchannel = msg.channel
  let member = msg.member
  let fullMsgArray = msg.content.split(' ')
  let cmd = fullMsgArray[0].slice(1, fullMsgArray[0].length).toUpperCase()
  let args = fullMsgArray.slice(1, fullMsgArray.length)

  // Command: Help
  if (cmd === 'HELP') {
    let msg = '__**COMMAND HELP:**__\n**===============================**\n*Syntax: [] = required arguments; {} = optional arguments*\n\n'
    for (let key in helpfile) {
      msg += '**' + pf + key + '**' + ' - ' + helpfile[key].info.description + '\n'
    }

    mchannel.sendMessage(msg)
    return
  }

  // Command: Ping
  if (cmd === 'PING') return mh.logChannel(mchannel, 'info', 'Pong!')

  // Command: DB
  if (cmd === 'DB') {
    console.log(volume)
    return
  }

  // Command: Play from YouTube Link
  if (cmd === 'PLAY') {
    let sourceID
    if (!member.voiceChannel) return mh.logChannel(mchannel, 'err', 'User is not in a voice channel!')
    if (args.length === 0) return mh.logChannel(mchannel, 'info', 'Adds a YouTube link to the playlist. Usage: *' + pf + 'play [url]*')
    if (args.length > 1) return mh.logChannel(mchannel, 'err', 'Invalid usage! Usage: ' + pf + 'play [url]')
    if (blacklist.users.includes(member.id)) return mh.logChannel(mchannel, 'bl', 'User is blacklisted!')
    if (radioMode) return mh.logChannel(mchannel, 'err', 'Songs cannot be queued while the bot is in radio mode!')
    if (checkCooldown(msg.createdTimestamp, lastMsgTimestamp, member, 5000)) return

    try {
      sourceID = parseYTUrl(args[0])
    } catch (err) {
      return mh.logChannel(mchannel, 'err', 'Error while parsing URL. Please make sure the URL is a valid YouTube link.')
    }

    if (sourceID.includes('p:')) {
      let playlistID = sourceID.substring(2)
      addPlaylist(playlistID, member, () => {
        mh.logChannel(mchannel, 'info', 'Playlist successfully added!')
        if (!voiceConnection) voiceConnect(member.voiceChannel)
      })

      prevPlayed = sourceID

      return
    }

    addSong(sourceID, msg.member, false, () => {
      if (!voiceConnection) voiceConnect(member.voiceChannel)

      prevPlayed = sourceID
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
    if (checkCooldown(msg.createdTimestamp, lastMsgTimestamp, member, 20000)) return
    if (prevPlayed.slice(0, 2) === 'p:') {
      addPlaylist(prevPlayed.slice(2), member, () => {
        mh.logChannel(mchannel, 'info', 'Playlist successfully re-queued!')
        if (!voiceConnection) voiceConnect(member.voiceChannel)
      })
    } else {
      addSong(prevPlayed, member, false, () => {
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
    if (checkCooldown(msg.createdTimestamp, lastMsgTimestamp, member, 15000)) return

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
    if (args.length === 1 && args[0].toUpperCase() === 'PINECONE' && (member.user.id === '160891371555782656' || member.user.id === '119495663506554880')) {
      volume = 10
      if (dispatcher) dispatcher.setVolume(volume)
      mh.logChannel(mchannel, 'vol', 'Volume set to: ∞')
    } else if (args.length === 1 && args[0] <= 100 && args[0] >= 1) {
      volume = args[0] * 0.005
      if (dispatcher) dispatcher.setVolume(volume)
      mh.logChannel(mchannel, 'vol', 'Volume set to: ' + args[0])
    } else mh.logChannel(mchannel, 'err', 'Invalid usage! Usage: ' + pf + 'volume [1-100]')
    return
  }

  if (cmd === 'RADIO') {
    if (args.length === 0) return mh.logChannel(mchannel, 'info', 'Controls the radio features of the bot. For more info, do: **' + pf + 'radio help**')
    if (args[0].toUpperCase() === 'HELP') return mchannel.sendMessage('__Manual page for: **' + pf + 'radio**__\n**' + pf + 'radio help** - Shows this manual page\n**' + pf + 'radio list** - Displays a list of radio stations\n**' + pf + 'radio set [station]** - Sets the radio to the specified station\n**' + pf + 'radio off** - Deactivates the radio')
    if (args[0].toUpperCase() === 'LIST') return mh.logChannel(mchannel, 'radioinf', '**Available Radio Stations:** ' + Object.keys(radiolist))

    if (args[0].toUpperCase() === 'SET') {
      if (args.length === 2) {
        if (voiceConnection) return mh.logChannel(mchannel, 'err', 'Bot cannot be in a voice channel while activating radio mode. Please disconnect the bot by using ' + pf + 'leave.')
        if (!member.voiceChannel) return mh.logChannel(mchannel, 'err', 'User is not in a voice channel!')
        if (!radiolist.hasOwnProperty(args[1].toUpperCase())) return mh.logChannel(mchannel, 'err', 'Invalid station! Use **' + pf + 'radio list** to see a list of all the stations')

        radioMode = true
        mh.logChannel(mchannel, 'radioinf', 'NOW PLAYING: Radio Station - **' + args[1] + '**')
        addPlaylist(radiolist[args[1].toUpperCase()], msg.member, () => { voiceConnect(member.voiceChannel) })
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
function parseYTUrl (url, callback) {
  let videoID

  if (url.includes('youtube.com') && url.includes('watch?v=')) videoID = url.split('watch?v=')[1].split('#')[0].split('&')[0]
  else if (url.includes('youtu.be')) videoID = url.split('be/')[1].split('?')[0]
  else if (url.includes('youtube.com') && url.includes('playlist?list=')) videoID = 'p:' + url.split('playlist?list=')[1]
  else throw Error('Not a YouTube Link')

  if (callback) return callback(videoID)
  return videoID
}

// Function: Adds song to queue
function addSong (videoID, member, suppress, callback) {
  yth.getVideo(videoID, (err, info) => {
    if (err) return mh.logChannel(mchannel, 'err', 'Error while parsing video(es). Please make sure the URL is valid.')
    if (info === 'EMPTY_VID') return
    let video = info.items[0]
    for (let video of blacklist.songs.videos) {
      if (!suppress) mh.logChannel(mchannel, 'bl', 'Sorry, but this video is blacklisted.')
      if (videoID.includes(video)) return
    }

    for (let keyword of blacklist.songs.keywords) {
      if (!suppress) mh.logChannel(mchannel, 'bl', 'Sorry, but this video is blacklisted.')
      if (video.snippet.title.toUpperCase().includes(keyword.toUpperCase())) return
    }

    if (!suppress) mh.logChannel(mchannel, 'info', 'Song successfully added to queue.')

    songQueue.push({
      video_ID: videoID,
      link: String('http://youtube.com/watch?v=' + videoID),
      requester: member.toString(),
      title: String(video.snippet.title),
      duration: convertDuration(video.contentDetails.duration)
    })

    if (callback) callback()
  })
}

// Function: Queues an entire playlist
function addPlaylist (playlistID, member, callback) {
  if (!radioMode) mh.logChannel(mchannel, 'musinf', 'Fetching playlist information...')
  yth.getPlaylist(playlistID, (err, playlist) => {
    if (err) return mh.logChannel(mchannel, 'err', 'Error while parsing playlist URL. Please make sure the URL is valid.')
    if (playlist.length === 0) return mh.logChannel(mchannel, 'err', 'The input playlist is empty. Please queue a non-empty playlist.')

    for (const index in playlist) {
      addSong(playlist[index].snippet.resourceId.videoId, member, true, () => {
        if ((playlist[playlist.length - 1] === playlist[index]) && (typeof callback === 'function')) callback()
      })
    }
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
