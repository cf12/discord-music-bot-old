const YoutubeApiHandler = require('./YouTubeApiHandler')
const mh = require('./MessageHandler')
const ytdl = require('ytdl-core')

class VoiceHandler {
  constructor (msgChannel, blacklist, youtubeApiKey) {
    this.msgChannel = msgChannel
    this.blacklist = blacklist
    this.yth = new YoutubeApiHandler(youtubeApiKey)

    this.msgChannel = undefined
    this.voiceHandler = undefined

    this.queue = []
    this.radioMode = false
    this.shuffle = false
    this.nowPLaying = undefined
    this.prevPlayed = undefined

    this.volume = 0.15
    this.stream = undefined
    this.dispatcher = undefined
    this.voiceConnection = undefined
  }

  // Function: Update msgChannel
  updateMsgChannel (channel) {
    if (this.msgChannel !== channel) this.msgChannel = channel
  }

  // Function: Parse YT Url
  parseYTUrl (url) {
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
  addTrack (videoID, member, suppress) {
    return new Promise((resolve, reject) => {
      if (this.blacklist.songs.videos.includes(videoID) && !suppress) return mh.logChannel(this.msgChannel, 'bl', `Sorry, but this video is blacklisted. **[Video ID in Blacklist]**`)

      this.yth.getVideo(videoID)
      .then((info) => {
        let video = info.items[0]

        for (let keyword of this.blacklist.songs.keywords) {
          if (video.snippet.title.toUpperCase().includes(keyword.toUpperCase()) && !suppress) return mh.logChannel(this.msgChannel, 'bl', `Sorry, but this video is blacklisted. **[Keyword: ${keyword}]**`)
        }

        this.queue.push({
          video_ID: videoID,
          link: String('http://youtube.com/watch?v=' + videoID),
          requester: member.toString(),
          title: String(video.snippet.title),
          duration: this.convertDration(video.contentDetails.duration)
        })

        this.setPrevPlayed({
          type: 'video',
          id: videoID
        })

        if (!suppress) mh.logChannel(this.msgChannel, 'info', 'Song successfully added to queue.')
        resolve()
      })

      .catch((err) => {
        reject(err)
      })
    })
  }

  // Function: Queues an entire playlist
  addPlaylist (playlistID, member) {
    return new Promise((resolve, reject) => {
      if (!this.radioMode) mh.logChannel(this.msgChannel, 'musinf', 'Fetching playlist information...')

      this.yth.getPlaylist(playlistID)
        .then((playlist) => {
          if (playlist.length === 0) return mh.logChannel(this.msgChannel, 'err', 'The input playlist is empty. Please queue a non-empty playlist.')

          for (const index in playlist) {
            this.addTrack(playlist[index].snippet.resourceId.videoId, member, true)
              .then(() => {
                if (playlist[playlist.length - 1] === playlist[index]) resolve()
              })
              .catch((err) => {
                if (err !== 'EMPTY_VID') reject(err)
              })
          }

          this.setPrevPlayed({
            type: 'playlist',
            id: playlistID
          })
        })

        .catch((err) => {
          reject(err)
        })
    })
  }

  // Function: Plays next song
  nextSong () {
    if (this.radioMode || this.shuffle) this.nowPlaying = this.queue[Math.floor(Math.random() * this.queue.length)]
    else this.nowPlaying = this.queue[0]

    if (!this.radioMode) {
      mh.logChannel(this.msgChannel, 'musinf', 'NOW PLAYING: **' + this.nowPlaying.title + ' - [' + this.nowPlaying.duration + ']** - requested by ' + this.nowPlaying.requester)
      mh.logConsole('info', 'Now playing: ' + this.nowPlaying.title)
    }

    this.stream = ytdl(this.nowPlaying.link, {quality: 'lowest'})
    this.dispatcher = this.voiceConnection.playStream(this.stream)
    this.dispatcher.setVolume(this.volume)
    return this.dispatcher.on('end', () => {
      if (this.voiceConnection.channel.members.array().length === 1) return this.voiceDisconnect(true)
      if (!this.radioMode) {
        this.queue.shift()
        if (this.queue.length === 0) {
          this.voiceDisconnect(false)
          return
        }
      }
      this.dispatcher = this.nextSong()
      return
    })
  }

  // Function Connects to Voice Channel
  voiceConnect (channel) {
    this.voiceChannel = channel
    channel.join()
      .then((connection) => {
        mh.logConsole('info', 'Joining Voice Channel <' + this.voiceChannel.id + '>')
        this.voiceConnection = connection
        this.dispatcher = this.nextSong()
      })
  }

  // Function: Disconnect from Voice Channel
  voiceDisconnect (emptyVoice = false) {
    mh.logConsole('info', 'Leaving Voice Channel <' + this.voiceChannel.id + '>')
    if (!emptyVoice) mh.logChannel(this.msgChannel, 'musinf', 'Queue ended. Disconnecting...')
    else mh.logChannel(this.msgChannel, 'musinf', 'Empty voice channel detected. Disconnecting...')

    this.voiceConnection.disconnect()
    this.voiceConnection = undefined
    this.dispatcher = undefined
  }

  // Function: Convert Durations from ISO 8601
  convertDration (duration) {
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

  setVolume (volume) {
    if (this.dispatcher) this.dispatcher.setVolume(this.volume)
    this.volume = volume * 0.005
  }

  setPrevPlayed (data) {
    this.prevPlayed = data
  }
}

module.exports = VoiceHandler
