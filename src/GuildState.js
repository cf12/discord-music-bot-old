class GuildState {
  constructor (id, callback) {
    this.id = id
    this.timeout = undefined
    this.callback = callback
    this.state = {
      responseCapture: {
        count: 0,
        handler: undefined
      },

      voiceData: {
        channel: null
      },

      searchResults: []
    }

    this.resetTimeout()
  }

  resetTimeout () {
    if (this.timeout) clearTimeout(this.state.timeout)
    this.timeout = setTimeout(this.callback, 300000)
  }

  resetState () {
    this.state = {
      responseCapture: {
        count: 0,
        handler: undefined
      },

      voiceData: {
        channel: null
      },

      searchResults: [],
      timeout: this.resetTimeout()
    }
  }

  // Guild State Getters
  getGuildState () {
    this.resetTimeout()
    return this.state
  }

  getGuildSearchResults () {
    this.resetTimeout()
    return this.state.searchResults
  }

  getGuildResponseCapturer () {
    this.resetTimeout()
    return this.state.responseCapture
  }

  getGuildVoiceData () {
    this.resetTimeout()
    return this.state.voiceData
  }

  // Guild State Setters
  setGuildState (state) {
    this.resetTimeout()
    this.state = state
  }

  setGuildSearchResults (state) {
    this.resetTimeout()
    this.state.searchResults = state
  }

  setGuildResponseCapturer (state) {
    this.resetTimeout()
    this.state.responseCapture = state
  }

  setGuildVoiceData (state) {
    this.resetTimeout()
    this.state.voiceData = state
  }

  // State Modifiers
  resetResponseCapturer () {
    this.resetTimeout()
    this.state.responseCapture = {
      count: 0,
      handler: undefined
    }
  }
}

module.exports = GuildState
