'use strict'

const APIClientBase = require('cluster-client').APIClientBase
const RegistryClient = require('./registry_client')
const eurekaUtil = require('./eureka').eurekaUtil
const BreakerRequest = require('./breaker_request')

class APIClient extends APIClientBase {
  constructor (options) {
    super(options)

    this.logger = options.logger
    this.circuitBreakerConfig = options.circuitBreakerConfig
    this.curl = options.curl

    this._cache = {}

    // subscribe:
    // {
    //   foo: reg1,
    //   bar: reg2,
    // }
    const subscribe = options.subscribe

    for (const key in subscribe) {
      let client = subscribe[key]
      if (!client.dataId) {
        client.dataId = key
      }
      this.subscribe(subscribe[key], value => {
        this._cache[key] = value
      })
    }
  }
  // 返回原始的客户端类
  get DataClient () {
    return RegistryClient
  }

  // 用于设置 cluster-client 相关参数，等同于 cluster 方法的第二个参数
  get clusterOptions () {
    return {
      responseTimeout: 120 * 1000
    }
  }

  subscribe (reg, listener) {
    this._client.subscribe(reg, listener)
  }

  publish (reg) {
    this._client.publish(reg)
  }

  client (key) {
    const instances = this._cache[key]
    if (!Array.isArray(instances) || instances.length === 0) {
      // this.ctx.logger.error('get 0 instances!!');
      throw new Error('get 0 instances of ' + key)
    }
    const ins = eurekaUtil.getOneInstanceFromAll(instances)
    const serverUrl = eurekaUtil.getServerPath(ins)
    return new BreakerRequest(serverUrl, {
      circuitBreakerConfig: this.circuitBreakerConfig,
      logger: this.logger,
      curl: this.curl
    })
  }
}

module.exports = APIClient
