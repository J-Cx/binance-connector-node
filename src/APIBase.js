const crypto = require('crypto')
const { removeEmptyValue, buildQueryString, createRequest, defaultLogger } = require('./helpers/utils')

class APIBase {
  constructor (options) {
    const { apiKey, apiSecret, baseURL, logger, useServerTimeOffset } = options

    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.baseURL = baseURL
    this.logger = logger || defaultLogger
    
    this.useServerTimeOffset = useServerTimeOffset
    this.timeOffset = 0
    this.timeOffsetLastSync = 0

    if(this.useServerTimeOffset) {
      this.getServerTimeOffset()
    }
  }

  getServerTimeOffset () {
    const now = +new Date()
    if(now - this.timeOffsetLastSync >= 300) {
      this.publicRequest("GET", "/api/v3/time")
        .then(res => this.timeOffset = res.data.serverTime - now)
        .then(_ => this.timeOffsetLastSync = now)
    }
  }

  publicRequest (method, path, params = {}) {
    params = removeEmptyValue(params)
    params = buildQueryString(params)
    if (params !== '') {
      path = `${path}?${params}`
    }
    return createRequest({
      method: method,
      baseURL: this.baseURL,
      url: path,
      apiKey: this.apiKey
    })
  }

  signRequest (method, path, params = {}) {
    if(this.useServerTimeOffset && !this.timeOffsetLastSync) {
      throw new Error("server time offset sync not yet done")
    }
    params = removeEmptyValue(params)
    const timestamp = Date.now() + this.timeOffset
    const queryString = buildQueryString({ ...params, timestamp })
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex')

    return createRequest({
      method: method,
      baseURL: this.baseURL,
      url: `${path}?${queryString}&signature=${signature}`,
      apiKey: this.apiKey
    })
  }
}

module.exports = APIBase
