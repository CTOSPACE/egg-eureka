const circuitBreaker = require('opossum')

class BreakerRequest {
  constructor (serverUrl, opts) {
    this.serverUrl = serverUrl
    let breakerConfig = opts.circuitBreakerConfig
    this.logger = opts.logger
    this.circuitBreaker = circuitBreaker(async (url, _opts) => {
      const res = await opts.curl(url, _opts)
      return res
    }, breakerConfig)
  }

  async get (path, data) {
    let res = await this.curl(path, {
      method: 'GET',
      data
    })
    return res
  }

  async post (path, data) {
    let res = await this.curl(path, {
      method: 'POST',
      contentType: 'json',
      data
    })
    return res
  }

  async put (path, data) {
    let res = await this.curl(path, {
      method: 'PUT',
      contentType: 'json',
      data
    })
    return res
  }

  async patch (path, data) {
    let res = await this.curl(path, {
      method: 'PATCH',
      contentType: 'json',
      data
    })
    return res
  }

  async del (path) {
    let res = await this.curl(path, {
      method: 'DELETE',
      contentType: 'json'
    })
    return res
  }

  async curl (path, opts) {
    opts = Object.assign(
      {
        timeout: [ '30s', '30s' ],
        dataType: 'json'
      },
      opts
    )
    let url = this.serverUrl + path
    this.circuitBreaker.fallback(err => {
      this.logger.error(`[circuitBreaker]-fallback: ${url} got error`, err)
      return {
        code: '502',
        message: '服务无法访问，url:' + url,
        data: ''
      }
    })

    const t1 = Date.now()
    const result = await this.circuitBreaker.fire(url, opts).then(r => {
      const cost = Date.now() - t1
      this.logger.info('[circuitBreaker]-[%sms]response from [%s]: %j', cost, url, r)
      return r && r.data
    })
    return result
  }
}

module.exports = BreakerRequest
