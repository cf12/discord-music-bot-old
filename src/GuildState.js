class GuildState {
  constructor (id) {
    this.id = id
    this.timeout = undefined

    this.searchResults = []
    this.responseCapture = {
      count: 0,
      handler: undefined
    }

    this.lastMsgTimestamp = 0

    this.resetTimeout()
  }

  resetTimeout () {
    if (this.timeout) clearTimeout(this.timeout)
    this.timeout = setTimeout(this.clearTempData, 300000)
  }

  clearTempData () {
    this.searchResults = []
    this.responseCapture = {
      count: 0,
      handler: undefined
    }
  }

  checkIfPrunable () {
    if (!this.searchResults && !this.responseCapture.handler) return true
    else return false
  }

  // Guild State Getters
  getGuildSearchResults () {
    this.resetTimeout()
    return this.searchResults
  }

  getGuildResponseCapturer () {
    this.resetTimeout()
    return this.responseCapture
  }

  getGuildVoiceData () {
    this.resetTimeout()
    return this.voiceData
  }

  // Guild State Setters
  setGuildSearchResults (state) {
    this.resetTimeout()
    this.searchResults = state
  }

  setGuildResponseCapturer (state) {
    this.resetTimeout()
    this.responseCapture = state
  }

  // State Modifiers
  resetResponseCapturer () {
    this.resetTimeout()
    this.responseCapture = {
      count: 0,
      handler: undefined
    }
  }
}

module.exports = GuildState
