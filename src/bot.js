// Import Requirements
const DiscordJS = require('discord.js')
const fs = require('fs')
const path = require('path')
const ytdl = require('ytdl-core')
const YouTubeAPIHandler = require('./youtubeapihandler')

// Load Files
try {
  var cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'config.json')))
} catch (err) {
  if (err) throw err
}

// Object Construction
const bot = new DiscordJS.Client()
const yth = new YouTubeAPIHandler(cfg.youtube_api_key)

// Variable Decleration
let pf = '$'
let voiceConnection
let voiceChannel
let dispatcher
let songQueue = []
let volume = 0.15
let mchannel

// Init Bot
bot.login(cfg.bot_token)

/*
// Bot Events
*/

// On: Bot ready
bot.on('ready', () => {
  console.log('BOT > Music Bot started')
  bot.user.setGame('v0.1.0 - By CF12')
})

// On: Message Creation
bot.on('message', (msg) => {
  // Cancels messages without pf or user is a bot
  if (msg.author.bot || !msg.content.startsWith(pf)) return

  // Command variables
  mchannel = msg.channel
  let member = msg.member
  let fullMsgArray = msg.content.split(' ')
  let cmd = fullMsgArray[0].slice(1, fullMsgArray[0].length).toUpperCase()
  let args = fullMsgArray.slice(1, fullMsgArray.length)

  // Command: Ping
  if (cmd === 'PING') {
    msg.channel.sendMessage('**INFO > **Pong!')
  }

  // Command: DB
  if (cmd === 'DB') {
    console.log(songQueue)
  }

  // Command: Play from YouTube Link
  if (cmd === 'PLAY') {
    let sourceID
    if (!member.voiceChannel) return mchannel.sendMessage('**ERROR >** User is not in a voice channel!')

    if (args.length === 0) return mchannel.sendMessage('**INFO >** Adds a YouTube link to the playlist. Usage: *' + pf + 'play [url]*')
    else if (args.length > 1) return mchannel.sendMessage('**ERROR >** Invalid usage! Usage: ' + pf + 'play [url]')

    try {
      sourceID = parseYTUrl(args[0])
    } catch (err) {
      console.log('ERROR > ' + err)
      return mchannel.sendMessage('**ERROR >** Error while parsing URL. Please make sure the URL is a valid YouTube link.')
    }

    if (sourceID.includes('p:')) {
      let playlistID = sourceID.substring(2)
      console.log(playlistID)
      addPlaylist(playlistID, member, () => {
        if (!voiceConnection) {
          voiceConnect(member.voiceChannel)
          .then((connection) => {
            voiceConnection = connection
            dispatcher = nextSong()
            .on('end', () => {
              songQueue.shift()
              if (songQueue.length === 0) return voiceDisconnect()
              nextSong()
            })
          })
        }
      })
      return
    }

    addSong(sourceID, msg.member, false, () => {
      if (!voiceConnection) {
        voiceConnect(member.voiceChannel)
        .then((connection) => {
          voiceConnection = connection
          dispatcher = nextSong()
          .on('end', () => {
            songQueue.shift()
            if (songQueue.length === 0) return voiceDisconnect()
            nextSong()
          })
        })
      }
    })
  }

  // Command: Leave Voice Channel
  if (cmd === 'LEAVE') {
    if (!voiceConnection) return mchannel.sendMessage('**ERROR >** The bot is not in a voice channel!')
    songQueue = []
    dispatcher.end()
    voiceConnection = undefined
  }

  // Command: Volume Control
  if (cmd === 'VOLUME') {
    if (args.length === 0) return mchannel.sendMessage('**INFO >** Sets the volume of music. Usage: ' + pf + 'volume [1-100]')
    if (args.length === 1 && args[0] <= 100 && args[0] >= 1) {
      volume = args[0] * 0.002
      if (dispatcher) dispatcher.setVolume(volume)
      mchannel.sendMessage('**INFO >** Volume set to: ' + args[0])
    } else mchannel.sendMessage('**ERROR >** Invalid usage! Usage: ' + pf + 'volume [1-100]')
  }
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
  else return undefined

  if (callback) return callback(videoID)
  return videoID
}

// Function: Adds song to queue
function addSong (videoID, member, suppress, callback) {
  if (!suppress) mchannel.sendMessage('**INFO >** Fetching video information...')
  yth.getVideo(videoID, (err, info) => {
    if (err) return mchannel.sendMessage('**ERROR >** Error while parsing video(es). Please make sure the URL is valid.')
    let video = info.items[0]
    songQueue.push({
      video_ID: videoID,
      link: String('http://youtube.com/?v=' + videoID),
      requester: member.toString(),
      title: video.snippet.title,
      duration: video.contentDetails.duration
    })

    if (!suppress) mchannel.sendMessage('**INFO >** Song successfully added to queue.')
    if (callback) callback()
  })
}

// Function: Queues an entire playlist
function addPlaylist (playlistID, member, callback) {
  mchannel.sendMessage('**INFO >** Fetching playlist information...')
  yth.getPlaylist(playlistID, (err, playlist) => {
    if (err) return mchannel.sendMessage('**ERROR >** Error while parsing playlist URL. Please make sure the URL is valid.')

    for (const index in playlist) {
      addSong(playlist[index].snippet.resourceId.videoId, member, true, () => {
        if ((playlist[0] === playlist[index]) && (typeof callback === 'function')) callback()
      })
    }
  })
}

// Function: Plays next song
function nextSong () {
  let song = songQueue[0]

  mchannel.sendMessage('**MUSIC >** __NOW PLAYING__: ' + song.title + ' - [' + song.duration + '] - requested by ' + song.requester)
  return voiceConnection.playStream((ytdl(song.link)), {
    'volume': volume
  })
}

// Function Connects to Voice Channel
function voiceConnect (channel) {
  voiceChannel = channel
  console.log('INFO > Joining Voice Channel <' + voiceChannel.id + '>')
  return channel.join()
}

// Function: Disconnect from Voice Channel
function voiceDisconnect () {
  console.log('INFO > Leaving Voice Channel <' + voiceChannel.id + '>')
  mchannel.sendMessage('**INFO >** Queue ended. Disconnecting...')

  voiceConnection.disconnect()
}
